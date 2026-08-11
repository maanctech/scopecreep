import { NextResponse } from "next/server";
import { assertScheduledCaller, ScheduledCallerError } from "@/lib/auth/scheduled";
import {
  drainQueuedAnalysisJobs,
  recoverStaleAnalysisJobs,
} from "@/lib/analysisJobs/recovery";

export const maxDuration = 300;

/**
 * Recovery runs before the drain so a job stranded by the previous invocation
 * is back in the queue in time for this one to finish it.
 */
export async function GET(request: Request) {
  try {
    assertScheduledCaller(request);
  } catch (error) {
    if (error instanceof ScheduledCallerError)
      return NextResponse.json({ error: error.message }, { status: 401 });

    throw error;
  }

  const recovered = await recoverStaleAnalysisJobs();
  const drained = await drainQueuedAnalysisJobs();

  return NextResponse.json({ recovered, drained });
}
