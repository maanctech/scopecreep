import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type {
  ConnectorProvider,
  ConnectorSyncResult,
} from "@/lib/connectors/types";

function hash(message: ConnectorSyncResult["messages"][number]) {
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

export async function persistConnectorSync(input: {
  client: PoolClient;
  organizationId: string;
  connectionId: string;
  projectId: string;
  provider: ConnectorProvider;
  messages: ConnectorSyncResult["messages"];
}) {
  const { client } = input;
  const source = await client.query<{ id: string }>(
    "SELECT id FROM communication_sources WHERE organization_id=$1 AND connection_id=$2 AND external_id='provider-sync'",
    [input.organizationId, input.connectionId],
  );
  const sourceId = source.rows[0]?.id || randomUUID();

  if (!source.rows[0])
    await client.query(
      "INSERT INTO communication_sources (id,organization_id,connection_id,project_id,external_id,source_type,name) VALUES ($1,$2,$3,$4,'provider-sync',$5,$6)",
      [
        sourceId,
        input.organizationId,
        input.connectionId,
        input.projectId,
        input.provider,
        `${input.provider} synchronized communications`,
      ],
    );

  let inserted = 0;
  let updated = 0;

  for (const message of input.messages) {
    let threadId: string | null = null;

    if (message.externalThreadId) {
      const thread = await client.query<{ id: string }>(
        "SELECT id FROM communication_threads WHERE organization_id=$1 AND source_id=$2 AND external_id=$3",
        [input.organizationId, sourceId, message.externalThreadId],
      );

      threadId = thread.rows[0]?.id || randomUUID();

      if (!thread.rows[0])
        await client.query(
          `INSERT INTO communication_threads (id,organization_id,source_id,project_id,external_id,subject,participants,first_message_at,last_message_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$8) ON CONFLICT DO NOTHING`,
          [
            threadId,
            input.organizationId,
            sourceId,
            input.projectId,
            message.externalThreadId,
            message.subject,
            JSON.stringify(
              [message.senderEmail || message.sender].filter(Boolean),
            ),
            message.timestamp,
          ],
        );

      const selected = await client.query<{ id: string }>(
        "SELECT id FROM communication_threads WHERE organization_id=$1 AND source_id=$2 AND external_id=$3",
        [input.organizationId, sourceId, message.externalThreadId],
      );

      threadId = selected.rows[0]?.id || threadId;
    }

    const result = await client.query<{ inserted: boolean }>(
      `INSERT INTO client_messages
       (id,organization_id,project_id,source_id,thread_id,external_id,source,sender,sender_email,recipients,subject,message_text,message_date,edited_at,deleted_at,content_sha256,raw_metadata,ingested_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17::jsonb,now())
       ON CONFLICT (organization_id,source_id,external_id) DO UPDATE SET
         thread_id=EXCLUDED.thread_id,sender=EXCLUDED.sender,sender_email=EXCLUDED.sender_email,recipients=EXCLUDED.recipients,subject=EXCLUDED.subject,
         message_text=EXCLUDED.message_text,message_date=EXCLUDED.message_date,edited_at=EXCLUDED.edited_at,deleted_at=EXCLUDED.deleted_at,
         content_sha256=EXCLUDED.content_sha256,raw_metadata=EXCLUDED.raw_metadata,ingested_at=now()
       WHERE client_messages.content_sha256 IS DISTINCT FROM EXCLUDED.content_sha256
          OR client_messages.edited_at IS DISTINCT FROM EXCLUDED.edited_at
          OR client_messages.deleted_at IS DISTINCT FROM EXCLUDED.deleted_at
       RETURNING (xmax=0) AS inserted`,
      [
        randomUUID(),
        input.organizationId,
        input.projectId,
        sourceId,
        threadId,
        message.externalId,
        input.provider,
        message.sender,
        message.senderEmail,
        JSON.stringify(message.recipients),
        message.subject,
        message.text,
        message.timestamp,
        message.editedTimestamp,
        message.deletedTimestamp || null,
        hash(message),
        JSON.stringify(message.rawMetadata),
      ],
    );

    if (result.rows[0]?.inserted) inserted += 1;
    else if (result.rows[0]) updated += 1;

    if (threadId && result.rows[0])
      await client.query(
        "UPDATE communication_threads SET last_message_at=GREATEST(last_message_at,$1),updated_at=now() WHERE id=$2 AND organization_id=$3",
        [message.timestamp, threadId, input.organizationId],
      );
  }

  return {
    received: input.messages.length,
    inserted,
    updated,
    unchanged: input.messages.length - inserted - updated,
  };
}
