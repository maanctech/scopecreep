import { after, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import {
  processAnalysisBatch,
  queueAnalysisJobs,
} from "@/lib/analysisJobs/service";

const schema = z
  .object({
    projectId: z.string().uuid(),
    messageIds: z.array(z.string().uuid()).min(1).max(100),
  })
  .strict();

export async function POST(request: Request) {
  try {
    await requireApiPermission(request, "findings:review");
    const queued = await queueAnalysisJobs(schema.parse(await request.json()));
    if (queued.queued > 0)
      after(async () => {
        await processAnalysisBatch(queued.organizationId, queued.batchId);
      });
    return NextResponse.json(
      {
        batch: {
          id: queued.batchId,
          selected: queued.selected,
          queued: queued.queued,
          skipped: queued.skipped,
        },
      },
      { status: 202 },
    );
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : error instanceof Error &&
            /Select at least|at most 100|Approve a Scope Boundary Map|has no boundary items/.test(
              error.message,
            )
          ? error.message
          : "The analysis batch could not be queued.";
    return NextResponse.json(
      { error: message },
      { status: error instanceof z.ZodError ? 400 : 422 },
    );
  }
}
