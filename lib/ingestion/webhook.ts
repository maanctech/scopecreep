import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { WEBHOOK_SIGNATURE_WINDOW_SECONDS } from "@/constants/typescript/ingestion";
import { withAuthenticatedTenant } from "@/lib/auth/scope";
import { withSystemAccess, withTenant } from "@/lib/db/tenantContext";
import { query, transaction } from "@/lib/db/client";
import { parseManualImport } from "@/lib/ingestion/manual";
import type { NormalizedCommunication } from "@/lib/ingestion/types";
import { decryptSecret, encryptSecret } from "@/lib/security/secrets";

type Row = Record<string, unknown>;

function contextKey(organizationId: string, connectionId: string) {
  return `${organizationId}:${connectionId}:webhook-signing-secret`;
}

export function webhookSignature(
  secret: string,
  timestamp: string,
  body: string,
) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export function verifyWebhookSignature(input: {
  secret: string;
  timestamp: string;
  signature: string;
  body: string;
  now?: number;
}) {
  const timestamp = Number(input.timestamp);
  const now = Math.floor((input.now ?? Date.now()) / 1000);

  if (
    !Number.isInteger(timestamp) ||
    Math.abs(now - timestamp) > WEBHOOK_SIGNATURE_WINDOW_SECONDS
  )
    throw new Error("Webhook timestamp is missing or expired.");

  const expected = Buffer.from(
    webhookSignature(input.secret, input.timestamp, input.body),
  );
  const actual = Buffer.from(input.signature);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new Error("Webhook signature is invalid.");
}

export async function createWebhookConnection(input: {
  projectId: string;
  name: string;
}) {
  return withAuthenticatedTenant(async (auth) => {

    const project = await query<Row>(
      "SELECT id FROM projects WHERE id=$1 AND organization_id=$2",
      [input.projectId, auth.organizationId],
    );

    if (!project.rows[0]) throw new Error("Project not found.");

    const connectionId = randomUUID();
    const secret = randomBytes(32).toString("base64url");
    const encrypted = encryptSecret(
      secret,
      contextKey(auth.organizationId, connectionId),
    );

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO communication_connections (id,organization_id,provider,name,status,configuration,sync_scope,data_permissions) VALUES ($1,$2,'Webhook',$3,'Credentials Required',$4::jsonb,'Signed inbound messages','["Message text","sender","recipients","timestamps","thread identifiers"]'::jsonb)`,
        [
          connectionId,
          auth.organizationId,
          input.name.trim(),
          JSON.stringify({ projectId: input.projectId }),
        ],
      );
      await client.query(
        "INSERT INTO encrypted_secrets (id,organization_id,connection_id,name,ciphertext,initialization_vector,auth_tag) VALUES ($1,$2,$3,'webhook-signing-secret',$4,$5,$6)",
        [
          randomUUID(),
          auth.organizationId,
          connectionId,
          encrypted.ciphertext,
          encrypted.initializationVector,
          encrypted.authTag,
        ],
      );
      await client.query(
        "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,'webhook.connection.created','communication_connection',$4,'{}'::jsonb)",
        [randomUUID(), auth.organizationId, auth.userId, connectionId],
      );
    });

    return {
      connectionId,
      secret,
      endpoint: `/api/webhooks/${connectionId}`,
      status: "Credentials Required" as const,
    };
  });
}

function messageHash(message: NormalizedCommunication) {
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

export async function receiveWebhook(input: {
  connectionId: string;
  deliveryId: string;
  timestamp: string;
  signature: string;
  body: string;
}) {
  if (!input.deliveryId.trim() || input.deliveryId.length > 200)
    throw new Error("Webhook delivery ID is required.");

  if (Buffer.byteLength(input.body) > 1_000_000)
    throw new Error("Webhook payloads must be 1 MB or smaller.");

  const connection = await withSystemAccess("webhook-routing", () => query<Row>(
    `SELECT c.*,s.ciphertext,s.initialization_vector,s.auth_tag FROM communication_connections c JOIN encrypted_secrets s ON s.connection_id=c.id AND s.organization_id=c.organization_id AND s.name='webhook-signing-secret' WHERE c.id=$1 AND c.provider='Webhook' AND c.status<>'Disabled'`,
    [input.connectionId],
  ));
  const row = connection.rows[0];

  if (!row) throw new Error("Webhook connection not found.");

  const organizationId = String(row.organization_id);
  const secret = decryptSecret(
    {
      ciphertext: String(row.ciphertext),
      initializationVector: String(row.initialization_vector),
      authTag: String(row.auth_tag),
    },
    contextKey(organizationId, input.connectionId),
  );

  verifyWebhookSignature({
    secret,
    timestamp: input.timestamp,
    signature: input.signature,
    body: input.body,
  });
  const configuration = row.configuration as { projectId?: string };

  if (!configuration.projectId)
    throw new Error("Webhook has no project route.");

  const preview = parseManualImport({ format: "JSON", content: input.body });
  const payloadHash = createHash("sha256").update(input.body).digest("hex");

  return withTenant(organizationId, () => transaction(async (client) => {
    const prior = await client.query<{ payload_sha256: string }>(
      "SELECT payload_sha256 FROM webhook_deliveries WHERE organization_id=$1 AND connection_id=$2 AND delivery_id=$3",
      [organizationId, input.connectionId, input.deliveryId],
    );

    if (prior.rows[0]) {
      if (prior.rows[0].payload_sha256 !== payloadHash)
        throw new Error(
          "Webhook delivery ID was reused with different content.",
        );

      return {
        inserted: 0,
        duplicates: preview.messages.length,
        replayed: true,
      };
    }

    await client.query(
      "INSERT INTO webhook_deliveries (id,organization_id,connection_id,delivery_id,payload_sha256) VALUES ($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        organizationId,
        input.connectionId,
        input.deliveryId,
        payloadHash,
      ],
    );
    const source = await client.query<{ id: string }>(
      "SELECT id FROM communication_sources WHERE organization_id=$1 AND connection_id=$2 AND external_id='inbound'",
      [organizationId, input.connectionId],
    );
    const sourceId = source.rows[0]?.id || randomUUID();

    if (!source.rows[0])
      await client.query(
        "INSERT INTO communication_sources (id,organization_id,connection_id,project_id,external_id,source_type,name) VALUES ($1,$2,$3,$4,'inbound','Webhook','Signed inbound webhook')",
        [sourceId, organizationId, input.connectionId, configuration.projectId],
      );

    const jobId = randomUUID();

    await client.query(
      "INSERT INTO ingestion_jobs (id,organization_id,connection_id,project_id,job_type,status,input,attempt_count,progress,max_attempts,idempotency_key,started_at) VALUES ($1,$2,$3,$4,'Webhook Delivery','Running',$5::jsonb,1,10,1,$6,now())",
      [
        jobId,
        organizationId,
        input.connectionId,
        configuration.projectId,
        JSON.stringify({
          deliveryId: input.deliveryId,
          messageCount: preview.messages.length,
        }),
        `webhook:${input.connectionId}:${input.deliveryId}`,
      ],
    );
    let inserted = 0;

    for (const message of preview.messages) {
      const result = await client.query(
        `INSERT INTO client_messages (id,organization_id,project_id,source_id,external_id,source,sender,sender_email,recipients,subject,message_text,message_date,edited_at,content_sha256,raw_metadata,ingested_at) VALUES ($1,$2,$3,$4,$5,'Webhook',$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14::jsonb,now()) ON CONFLICT DO NOTHING RETURNING id`,
        [
          randomUUID(),
          organizationId,
          configuration.projectId,
          sourceId,
          message.externalId,
          message.sender,
          message.senderEmail,
          JSON.stringify(message.recipients),
          message.subject,
          message.text,
          message.timestamp,
          message.editedTimestamp,
          messageHash(message),
          JSON.stringify(message.rawMetadata),
        ],
      );

      inserted += result.rowCount || 0;
    }

    const result = {
      inserted,
      duplicates: preview.messages.length - inserted,
      replayed: false,
    };

    await client.query(
      "UPDATE ingestion_jobs SET status='Succeeded',progress=100,result=$1::jsonb,completed_at=now(),updated_at=now() WHERE id=$2",
      [JSON.stringify(result), jobId],
    );
    await client.query(
      "UPDATE communication_connections SET status='Connected',connection_verified_at=COALESCE(connection_verified_at,now()),last_tested_at=now(),last_synced_at=now(),last_error=NULL,updated_at=now() WHERE id=$1 AND organization_id=$2",
      [input.connectionId, organizationId],
    );

    return result;
  }));
}
