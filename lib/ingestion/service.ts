import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { withAuthenticatedTenant } from "@/lib/auth/scope";
import { query, transaction } from "@/lib/db/client";
import type {
  ImportPreview,
  NormalizedCommunication,
} from "@/lib/ingestion/types";

type Row = Record<string, unknown>;

function contentHash(message: NormalizedCommunication) {
  return createHash("sha256")
    .update(
      [
        message.senderEmail || message.sender || "",
        message.timestamp || "",
        message.text,
      ].join("\n"),
    )
    .digest("hex");
}

async function threadId(
  client: PoolClient,
  organizationId: string,
  sourceId: string,
  projectId: string,
  message: NormalizedCommunication,
) {
  if (!message.externalThreadId) return null;

  const existing = await client.query<{ id: string }>(
    "SELECT id FROM communication_threads WHERE organization_id=$1 AND source_id=$2 AND external_id=$3",
    [organizationId, sourceId, message.externalThreadId],
  );

  if (existing.rows[0]) return existing.rows[0].id;

  const id = randomUUID();

  await client.query(
    `INSERT INTO communication_threads (id,organization_id,source_id,project_id,external_id,subject,participants,first_message_at,last_message_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$8) ON CONFLICT (organization_id,source_id,external_id) DO NOTHING`,
    [
      id,
      organizationId,
      sourceId,
      projectId,
      message.externalThreadId,
      message.subject,
      JSON.stringify([message.senderEmail || message.sender].filter(Boolean)),
      message.timestamp,
    ],
  );
  const result = await client.query<{ id: string }>(
    "SELECT id FROM communication_threads WHERE organization_id=$1 AND source_id=$2 AND external_id=$3",
    [organizationId, sourceId, message.externalThreadId],
  );

  return result.rows[0]?.id || id;
}

export async function importManualMessages(input: {
  projectId: string;
  preview: ImportPreview;
}) {
  return withAuthenticatedTenant(async (auth) => {
    const idempotencyKey = createHash("sha256")
      .update(`${input.projectId}\n${JSON.stringify(input.preview.messages)}`)
      .digest("hex");

    return transaction(async (client) => {
      const project = await client.query<Row>(
        "SELECT id FROM projects WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [input.projectId, auth.organizationId],
      );

      if (!project.rows[0]) throw new Error("Project not found.");

      const prior = await client.query<Row>(
        "SELECT result FROM ingestion_jobs WHERE organization_id=$1 AND idempotency_key=$2 AND status='Succeeded'",
        [auth.organizationId, idempotencyKey],
      );

      if (prior.rows[0]) {
        const original = prior.rows[0].result as {
          jobId?: string;
          received?: number;
        };

        return {
          jobId: original.jobId,
          received: original.received || input.preview.messages.length,
          inserted: 0,
          duplicates: input.preview.messages.length,
          warnings: input.preview.warnings,
          repeated: true,
        };
      }

      const connection = await client.query<{ id: string }>(
        "SELECT id FROM communication_connections WHERE organization_id=$1 AND provider='Manual' ORDER BY created_at LIMIT 1",
        [auth.organizationId],
      );
      const connectionId = connection.rows[0]?.id || randomUUID();

      if (!connection.rows[0])
        await client.query(
          "INSERT INTO communication_connections (id,organization_id,provider,name,status,connection_verified_at,sync_scope,data_permissions) VALUES ($1,$2,'Manual','Manual imports','Connected',now(),'User-selected projects','[\"Pasted and uploaded messages\"]'::jsonb)",
          [connectionId, auth.organizationId],
        );

      const sourceExternalId = `manual:${input.projectId}`;
      const source = await client.query<{ id: string }>(
        "SELECT id FROM communication_sources WHERE organization_id=$1 AND connection_id=$2 AND external_id=$3",
        [auth.organizationId, connectionId, sourceExternalId],
      );
      const sourceId = source.rows[0]?.id || randomUUID();

      if (!source.rows[0])
        await client.query(
          "INSERT INTO communication_sources (id,organization_id,connection_id,project_id,external_id,source_type,name) VALUES ($1,$2,$3,$4,$5,'Manual Import','Manual project import')",
          [
            sourceId,
            auth.organizationId,
            connectionId,
            input.projectId,
            sourceExternalId,
          ],
        );

      const jobId = randomUUID();

      await client.query(
        "INSERT INTO ingestion_jobs (id,organization_id,connection_id,project_id,job_type,status,input,attempt_count,progress,max_attempts,idempotency_key,started_at) VALUES ($1,$2,$3,$4,'Manual Import','Running',$5::jsonb,1,5,1,$6,now())",
        [
          jobId,
          auth.organizationId,
          connectionId,
          input.projectId,
          JSON.stringify({
            format: input.preview.format,
            messageCount: input.preview.messages.length,
          }),
          idempotencyKey,
        ],
      );
      let inserted = 0;
      let duplicates = 0;

      for (const message of input.preview.messages) {
        const linkedThread = await threadId(
          client,
          auth.organizationId,
          sourceId,
          input.projectId,
          message,
        );
        const result = await client.query(
          `INSERT INTO client_messages (id,organization_id,project_id,source_id,thread_id,external_id,source,sender,sender_email,recipients,subject,message_text,message_date,edited_at,content_sha256,raw_metadata,ingested_at)
           VALUES ($1,$2,$3,$4,$5,$6,'Manual',$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15::jsonb,now())
           ON CONFLICT DO NOTHING RETURNING id`,
          [
            randomUUID(),
            auth.organizationId,
            input.projectId,
            sourceId,
            linkedThread,
            message.externalId,
            message.sender,
            message.senderEmail,
            JSON.stringify(message.recipients),
            message.subject,
            message.text,
            message.timestamp,
            message.editedTimestamp,
            contentHash(message),
            JSON.stringify(message.rawMetadata),
          ],
        );

        if (result.rowCount) {
          inserted += 1;

          if (linkedThread)
            await client.query(
              "UPDATE communication_threads SET last_message_at=GREATEST(last_message_at,$1),updated_at=now() WHERE id=$2 AND organization_id=$3",
              [message.timestamp, linkedThread, auth.organizationId],
            );
        } else duplicates += 1;
      }

      const result = {
        jobId,
        received: input.preview.messages.length,
        inserted,
        duplicates,
        warnings: input.preview.warnings,
        repeated: false,
      };

      await client.query(
        "UPDATE ingestion_jobs SET status='Succeeded',progress=100,result=$1::jsonb,completed_at=now(),updated_at=now() WHERE id=$2 AND organization_id=$3",
        [JSON.stringify(result), jobId, auth.organizationId],
      );
      await client.query(
        "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,'communication.manual_import','ingestion_job',$4,$5::jsonb)",
        [
          randomUUID(),
          auth.organizationId,
          auth.userId,
          jobId,
          JSON.stringify({ projectId: input.projectId, inserted, duplicates }),
        ],
      );

      return result;
    });
  });
}

export async function listIngestionJobs() {
  return withAuthenticatedTenant(async (auth) => {
    const result = await query<Row>(
      "SELECT id,project_id,job_type,status,result,error_message,attempt_count,progress,created_at,started_at,completed_at FROM ingestion_jobs WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",
      [auth.organizationId],
    );

    return result.rows;
  });
}
