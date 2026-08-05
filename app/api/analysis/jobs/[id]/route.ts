import { after, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import {
  cancelAnalysisJob,
  processAnalysisBatch,
  recoverAnalysisJob,
  retryAnalysisJob,
  startOverAnalysisJob,
} from "@/lib/analysisJobs/service";

const schema = z
  .object({ action: z.enum(["cancel", "retry", "start-over", "recover"]) })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiPermission(request, "findings:review");
    const { id } = await params;
    const { action } = schema.parse(await request.json());

    if (action === "cancel")
      return NextResponse.json({ result: await cancelAnalysisJob(id) });

    if (action === "recover")
      return NextResponse.json({ result: await recoverAnalysisJob(id) });

    const retried =
      action === "start-over"
        ? await startOverAnalysisJob(id)
        : await retryAnalysisJob(id);

    after(async () => {
      await processAnalysisBatch(retried.organizationId, retried.batchId);
    });

    return NextResponse.json({ result: { status: "Queued" } }, { status: 202 });
  } catch (error) {
    const auth = authErrorResponse(error);

    if (auth) return auth;

    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues[0]?.message
            : error instanceof Error &&
                /cannot be retried|cannot be started over|can be cancelled|can be recovered|already exists|not found/.test(
                  error.message,
                )
              ? error.message
              : "The analysis job action could not be completed.",
      },
      { status: error instanceof z.ZodError ? 400 : 422 },
    );
  }
}
