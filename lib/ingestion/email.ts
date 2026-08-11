import { createHash, randomUUID } from "node:crypto";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { z } from "zod";
import { MAX_EMAIL_SOURCE_BYTES } from "@/constants/typescript/ingestion";
import { withAuthenticatedTenant } from "@/lib/auth/scope";
import type { AuthContext } from "@/lib/auth/types";
import { query, transaction } from "@/lib/db/client";
import { decryptSecret, encryptSecret } from "@/lib/security/secrets";
import {
  assertSafeIntegrationHost,
  safeIntegrationLookup,
} from "@/lib/security/network";

type Row = Record<string, unknown>;
export const emailConfigSchema = z
  .object({
    projectId: z.uuid(),
    name: z.string().trim().min(2).max(120),
    host: z.string().trim().min(1).max(253),
    port: z.number().int().min(1).max(65535).default(993),
    secure: z.boolean().default(true),
    username: z.string().trim().min(1).max(320),
    password: z.string().min(1).max(1000),
    folder: z.string().trim().min(1).max(500).default("INBOX"),
    allowedSenderDomains: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9.-]+$/),
      )
      .max(50)
      .default([]),
  })
  .strict();
export type EmailConfiguration = z.infer<typeof emailConfigSchema>;

const secretContext = (organizationId: string, connectionId: string) =>
  `${organizationId}:${connectionId}:imap-password`;

export async function configureEmailConnection(raw: unknown) {
  const config = emailConfigSchema.parse(raw);

  return withAuthenticatedTenant(async (user) => {

    await assertSafeIntegrationHost(config.host);

    if (!config.secure && process.env.ALLOW_INSECURE_IMAP !== "true")
      throw new Error(
        "TLS is required for IMAP. Set ALLOW_INSECURE_IMAP=true only for a trusted test server.",
      );

    const project = await query(
      "SELECT id FROM projects WHERE id=$1 AND organization_id=$2",
      [config.projectId, user.organizationId],
    );

    if (!project.rows[0]) throw new Error("Project not found.");

    const id = randomUUID();
    const encrypted = encryptSecret(
      config.password,
      secretContext(user.organizationId, id),
    );
    const stored = {
      projectId: config.projectId,
      host: config.host,
      port: config.port,
      secure: config.secure,
      username: config.username,
      folder: config.folder,
      allowedSenderDomains: config.allowedSenderDomains,
    };

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO communication_connections (id,organization_id,provider,name,status,configuration,sync_scope,data_permissions) VALUES ($1,$2,'IMAP',$3,'Credentials Required',$4::jsonb,$5,'["Email headers","plain-text body","attachment metadata"]'::jsonb)`,
        [
          id,
          user.organizationId,
          config.name,
          JSON.stringify(stored),
          `${config.folder} routed to one project`,
        ],
      );
      await client.query(
        "INSERT INTO encrypted_secrets (id,organization_id,connection_id,name,ciphertext,initialization_vector,auth_tag) VALUES ($1,$2,$3,'imap-password',$4,$5,$6)",
        [
          randomUUID(),
          user.organizationId,
          id,
          encrypted.ciphertext,
          encrypted.initializationVector,
          encrypted.authTag,
        ],
      );
    });

    return { id, status: "Credentials Required" as const };
  });
}

type LoadedEmailConnection = {
  user: AuthContext;
  row: Row;
  config: Omit<EmailConfiguration, "password" | "name">;
  password: string;
};

/**
 * The tenant scope has to stay open for the caller's own statements, so this
 * loads the connection and then runs the caller inside the same scope rather
 * than returning it.
 */
function withEmailConnection<T>(
  connectionId: string,
  work: (loaded: LoadedEmailConnection) => Promise<T>,
) {
  return withAuthenticatedTenant(async (user) => {
    const result = await query<Row>(
      `SELECT c.*,s.ciphertext,s.initialization_vector,s.auth_tag FROM communication_connections c JOIN encrypted_secrets s ON s.connection_id=c.id AND s.organization_id=c.organization_id AND s.name='imap-password' WHERE c.id=$1 AND c.organization_id=$2 AND c.provider='IMAP'`,
      [connectionId, user.organizationId],
    );

    if (!result.rows[0]) throw new Error("Email connection not found.");

    const row = result.rows[0];
    const config = row.configuration as Omit<
      EmailConfiguration,
      "password" | "name"
    >;
    const password = decryptSecret(
      {
        ciphertext: String(row.ciphertext),
        initializationVector: String(row.initialization_vector),
        authTag: String(row.auth_tag),
      },
      secretContext(user.organizationId, connectionId),
    );

    await assertSafeIntegrationHost(config.host);

    return work({ user, row, config, password });
  });
}

function imapClient(
  config: Omit<EmailConfiguration, "password" | "name">,
  password: string,
) {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.username, pass: password },
    logger: false,
    tls: { rejectUnauthorized: true, lookup: safeIntegrationLookup },
  });
}

function addressValues(
  value:
    | { value: Array<{ address?: string; name?: string }> }
    | Array<{ value: Array<{ address?: string; name?: string }> }>
    | undefined,
) {
  if (!value) return [];

  return (Array.isArray(value) ? value : [value]).flatMap(
    (group) => group.value,
  );
}

function messageReferences(value: string | string[] | undefined) {
  return value ? (Array.isArray(value) ? value : [value]) : [];
}

export async function testEmailConnection(connectionId: string) {
  return withEmailConnection(connectionId, async (loaded) => {
    const client = imapClient(loaded.config, loaded.password);

    try {
      await client.connect();
      await client.list();
      await client.logout();
      await query(
        "UPDATE communication_connections SET status='Connected',connection_verified_at=now(),last_tested_at=now(),last_error=NULL,updated_at=now() WHERE id=$1 AND organization_id=$2",
        [connectionId, loaded.user.organizationId],
      );

      return { connected: true };
    } catch {
      await client.logout().catch(() => undefined);
      await query(
        "UPDATE communication_connections SET status='Needs Attention',last_tested_at=now(),last_error='Connection test failed. Verify host, TLS, username, password, and mailbox access.',updated_at=now() WHERE id=$1 AND organization_id=$2",
        [connectionId, loaded.user.organizationId],
      );
      throw new Error(
        "Email connection test failed. Verify the server, TLS, credentials, and mailbox access.",
      );
    }
  });
}

export async function syncEmailConnection(connectionId: string) {
  return withEmailConnection(connectionId, async (loaded) => {
    const { user, config } = loaded;
    const jobId = randomUUID();

    await query(
      "INSERT INTO ingestion_jobs (id,organization_id,connection_id,project_id,job_type,status,input,attempt_count,progress,max_attempts,started_at) VALUES ($1,$2,$3,$4,'IMAP Sync','Running',$5::jsonb,1,5,3,now())",
      [
        jobId,
        user.organizationId,
        connectionId,
        config.projectId,
        JSON.stringify({ folder: config.folder }),
      ],
    );
    await query(
      "UPDATE communication_connections SET status='Syncing',last_error=NULL,updated_at=now() WHERE id=$1 AND organization_id=$2",
      [connectionId, user.organizationId],
    );
    const client = imapClient(config, loaded.password);

    try {
      await client.connect();
      const lock = await client.getMailboxLock(config.folder);
      const messages: Array<{
        uid: number;
        parsed: Awaited<ReturnType<typeof simpleParser>>;
      }> = [];
      let highestSeenUid = 0;
      let oversized = 0;

      try {
        const checkpoint = await query<Row>(
          "SELECT checkpoint_value FROM sync_checkpoints WHERE organization_id=$1 AND connection_id=$2 AND checkpoint_key='imap:last_uid'",
          [user.organizationId, connectionId],
        );
        const lastUid = Number(
          (checkpoint.rows[0]?.checkpoint_value as { uid?: number } | undefined)
            ?.uid || 0,
        );

        for await (const item of client.fetch(
          `${lastUid + 1}:*`,
          { uid: true, source: true },
          { uid: true },
        )) {
          if (!item.uid || item.uid <= lastUid || !item.source) continue;

          highestSeenUid = Math.max(highestSeenUid, item.uid);

          if (item.source.length > MAX_EMAIL_SOURCE_BYTES) {
            oversized += 1;
            continue;
          }

          const parsed = await simpleParser(item.source, {
            skipHtmlToText: true,
            skipImageLinks: true,
          });
          const sender = parsed.from?.value[0]?.address?.toLowerCase() || "";

          if (
            config.allowedSenderDomains.length &&
            !config.allowedSenderDomains.some((domain) =>
              sender.endsWith(`@${domain}`),
            )
          )
            continue;

          if (parsed.text?.trim()) messages.push({ uid: item.uid, parsed });
        }
      } finally {
        lock.release();
        await client.logout();
      }

      return await transaction(async (db) => {
        const source = await db.query<{ id: string }>(
          "SELECT id FROM communication_sources WHERE organization_id=$1 AND connection_id=$2 AND external_id=$3",
          [user.organizationId, connectionId, config.folder],
        );
        const sourceId = source.rows[0]?.id || randomUUID();

        if (!source.rows[0])
          await db.query(
            "INSERT INTO communication_sources (id,organization_id,connection_id,project_id,external_id,source_type,name) VALUES ($1,$2,$3,$4,$5,'Email',$6)",
            [
              sourceId,
              user.organizationId,
              connectionId,
              config.projectId,
              config.folder,
              `IMAP ${config.folder}`,
            ],
          );

        let inserted = 0;

        for (const { uid, parsed } of messages) {
          const sender = addressValues(parsed.from)[0];
          const recipients = [
            ...addressValues(parsed.to),
            ...addressValues(parsed.cc),
          ]
            .map((value) => value.address || value.name)
            .filter((value): value is string => Boolean(value));
          const text = parsed.text!.trim();
          const references = messageReferences(parsed.references);
          const threadExternalId =
            references[0] || parsed.inReplyTo || parsed.messageId || `uid:${uid}`;
          const thread = await db.query<{ id: string }>(
            "SELECT id FROM communication_threads WHERE organization_id=$1 AND source_id=$2 AND external_id=$3",
            [user.organizationId, sourceId, threadExternalId],
          );
          const threadId = thread.rows[0]?.id || randomUUID();

          if (!thread.rows[0])
            await db.query(
              "INSERT INTO communication_threads (id,organization_id,source_id,project_id,external_id,subject,participants,first_message_at,last_message_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$8) ON CONFLICT DO NOTHING",
              [
                threadId,
                user.organizationId,
                sourceId,
                config.projectId,
                threadExternalId,
                parsed.subject || null,
                JSON.stringify([sender?.address, ...recipients].filter(Boolean)),
                parsed.date?.toISOString() || null,
              ],
            );

          const result = await db.query<{ id: string }>(
            `INSERT INTO client_messages (id,organization_id,project_id,source_id,thread_id,external_id,source,sender,sender_email,recipients,subject,message_text,message_date,content_sha256,raw_metadata,ingested_at) VALUES ($1,$2,$3,$4,$5,$6,'Email',$7,$8,$9::jsonb,$10,$11,$12,$13,$14::jsonb,now()) ON CONFLICT DO NOTHING RETURNING id`,
            [
              randomUUID(),
              user.organizationId,
              config.projectId,
              sourceId,
              threadId,
              parsed.messageId || `uid:${uid}`,
              sender?.name || sender?.address || null,
              sender?.address?.toLowerCase() || null,
              JSON.stringify(recipients),
              parsed.subject || null,
              text,
              parsed.date?.toISOString() || null,
              createHash("sha256")
                .update(
                  `${sender?.address || ""}\n${parsed.date?.toISOString() || ""}\n${text}`,
                )
                .digest("hex"),
              JSON.stringify({
                uid,
                inReplyTo: parsed.inReplyTo || null,
                references,
              }),
            ],
          );

          if (result.rows[0]) {
            inserted += 1;

            if (threadId)
              await db.query(
                "UPDATE communication_threads SET last_message_at=GREATEST(last_message_at,$1),updated_at=now() WHERE id=$2 AND organization_id=$3",
                [
                  parsed.date?.toISOString() || null,
                  threadId,
                  user.organizationId,
                ],
              );

            for (const attachment of parsed.attachments)
              await db.query(
                "INSERT INTO communication_attachments (id,organization_id,message_id,filename,media_type,byte_size,content_sha256) VALUES ($1,$2,$3,$4,$5,$6,$7)",
                [
                  randomUUID(),
                  user.organizationId,
                  result.rows[0].id,
                  (attachment.filename || "attachment").slice(0, 240),
                  attachment.contentType || null,
                  attachment.size || null,
                  attachment.checksum || null,
                ],
              );
          }
        }

        if (highestSeenUid)
          await db.query(
            "INSERT INTO sync_checkpoints (id,organization_id,connection_id,checkpoint_key,checkpoint_value) VALUES ($1,$2,$3,'imap:last_uid',$4::jsonb) ON CONFLICT (organization_id,connection_id,checkpoint_key) DO UPDATE SET checkpoint_value=EXCLUDED.checkpoint_value,updated_at=now()",
            [
              randomUUID(),
              user.organizationId,
              connectionId,
              JSON.stringify({ uid: highestSeenUid }),
            ],
          );

        const result = {
          received: messages.length,
          inserted,
          duplicates: messages.length - inserted,
          highestUid: highestSeenUid,
          oversizedSkipped: oversized,
        };

        await db.query(
          "UPDATE ingestion_jobs SET status='Succeeded',progress=100,result=$1::jsonb,completed_at=now(),updated_at=now() WHERE id=$2",
          [JSON.stringify(result), jobId],
        );
        await db.query(
          "UPDATE communication_connections SET status='Connected',last_synced_at=now(),last_error=NULL,updated_at=now() WHERE id=$1",
          [connectionId],
        );

        return result;
      });
    } catch {
      await client.logout().catch(() => undefined);
      const message =
        "IMAP sync failed. Verify connection settings, TLS, mailbox permissions, and sender filters.";

      await query(
        "UPDATE ingestion_jobs SET status='Failed',error_message=$1,completed_at=now(),updated_at=now() WHERE id=$2",
        [message, jobId],
      );
      await query(
        "UPDATE communication_connections SET status='Needs Attention',last_error=$1,updated_at=now() WHERE id=$2",
        [message, connectionId],
      );
      throw new Error(
        "Email sync failed. Review the connection settings and job diagnostics.",
      );
    }
  });
}
