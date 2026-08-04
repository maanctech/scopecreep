import { NextResponse } from "next/server";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { listIngestionJobs } from "@/lib/ingestion/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "integrations:read");

    return NextResponse.json({ jobs: await listIngestionJobs() });
  } catch (error) {
    return (
      authErrorResponse(error) ||
      NextResponse.json(
        { error: "Could not load ingestion jobs." },
        { status: 500 },
      )
    );
  }
}
