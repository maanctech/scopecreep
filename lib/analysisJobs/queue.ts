import { createHash, randomUUID } from "node:crypto";
import { configuredProviderName } from "@/lib/ai/providers";
import { AI_PROMPT_VERSION } from "@/lib/aiPrompt";
import { transaction } from "@/lib/db/client";
import { approvedContext, configuredModel, jobMaxAttempts, reviewer } from "@/lib/analysisJobs/context";
import type { Row } from "@/lib/analysisJobs/types";

export async function queueAnalysisJobs(input: {
  projectId: string;
  messageIds: string[];
}) {
  const auth = await reviewer();

  return queueAnalysisJobsForActor(auth, input, "Manual");
}

export async function queueAnalysisJobsForActor(
  actor: { organizationId: string; userId: string },
  input: { projectId: string; messageIds: string[] },
  triggerSource: "Manual" | "Automation",
) {
  const uniqueMessageIds = [...new Set(input.messageIds)];

  if (!uniqueMessageIds.length)
    throw new Error("Select at least one communication.");

  if (uniqueMessageIds.length > 100)
    throw new Error("Analyze at most 100 communications in one batch.");

  const provider = configuredProviderName();
  const model = configuredModel(provider);
  const batchId = randomUUID();

  return transaction(async (client) => {
    const context = await approvedContext(
      actor.organizationId,
      input.projectId,
      client,
    );
    const messages = await client.query<Row>(
      `SELECT m.id,m.message_text,m.content_sha256
       FROM client_messages m
       LEFT JOIN scope_findings f ON f.organization_id=m.organization_id AND f.client_message_id=m.id
       WHERE m.organization_id=$1 AND m.project_id=$2 AND m.id=ANY($3::uuid[])
         AND m.deleted_at IS NULL AND f.id IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM analysis_jobs existing
           WHERE existing.organization_id=m.organization_id AND existing.client_message_id=m.id
         )`,
      [actor.organizationId, input.projectId, uniqueMessageIds],
    );
    let queued = 0;
    const jobIds: string[] = [];

    for (const message of messages.rows) {
      const jobId = randomUUID();
      const inputHash = createHash("sha256")
        .update(
          [
            AI_PROMPT_VERSION,
            context.sowHash,
            context.boundaryMapId,
            message.content_sha256 ||
              createHash("sha256")
                .update(String(message.message_text))
                .digest("hex"),
          ].join("\n"),
        )
        .digest("hex");
      const inserted = await client.query(
        `INSERT INTO analysis_jobs
         (id,organization_id,project_id,client_message_id,sow_version_id,boundary_map_id,batch_id,requested_by,
          provider,model,prompt_version,status,input_sha256,input_references,attempt_count,progress,max_attempts,trigger_source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Queued',$12,$13::jsonb,0,0,$14,$15)
         ON CONFLICT DO NOTHING RETURNING id`,
        [
          jobId,
          actor.organizationId,
          input.projectId,
          message.id,
          context.sowVersionId,
          context.boundaryMapId,
          batchId,
          actor.userId,
          provider,
          model,
          AI_PROMPT_VERSION,
          inputHash,
          JSON.stringify({
            messageId: message.id,
            sowVersionId: context.sowVersionId,
            boundaryMapId: context.boundaryMapId,
          }),
          jobMaxAttempts(),
          triggerSource,
        ],
      );

      if (inserted.rowCount) {
        queued += 1;
        jobIds.push(jobId);
      }
    }

    await client.query(
      "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,'analysis.batch.queued','analysis_batch',$4,$5::jsonb)",
      [
        randomUUID(),
        actor.organizationId,
        actor.userId,
        batchId,
        JSON.stringify({
          projectId: input.projectId,
          selected: uniqueMessageIds.length,
          eligible: messages.rows.length,
          queued,
          sowVersionId: context.sowVersionId,
          boundaryMapId: context.boundaryMapId,
          triggerSource,
        }),
      ],
    );

    return {
      organizationId: actor.organizationId,
      batchId,
      jobIds,
      selected: uniqueMessageIds.length,
      queued,
      skipped: uniqueMessageIds.length - queued,
    };
  });
}
