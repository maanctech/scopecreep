import { NextResponse } from "next/server";
import { generateAuditReport, NotFoundError, readAuditReport } from "@/lib/store";

export const runtime = "nodejs";

/** Read-only: returns the latest saved report. Never generates one. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const result = await readAuditReport(id);
    if (!result) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    if (!result.report) {
      return NextResponse.json(
        { error: "No report has been generated for this project yet." },
        { status: 404 }
      );
    }
    return NextResponse.json({ report: result.report });
  } catch {
    return NextResponse.json({ error: "Failed to load the report." }, { status: 500 });
  }
}

/** Explicit mutation: generates a new report snapshot (history is kept). */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const result = await generateAuditReport(id);
    return NextResponse.json({ report: result.report }, { status: 201 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to generate the report." }, { status: 500 });
  }
}
