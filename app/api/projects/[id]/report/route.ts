import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAuditReport, NotFoundError, readAuditReport } from "@/lib/store";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { REPORT_TYPES } from "@/lib/types";

export const runtime = "nodejs";

const generateSchema = z.object({ reportType: z.enum(REPORT_TYPES).default("Internal Scope Audit") }).strict();

function filename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "scopeledger-report";
}

/** Read-only: returns the latest saved report. Never generates one. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    await requireApiPermission(request, "reports:read");
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
    const format = new URL(request.url).searchParams.get("format");
    if (format === "markdown" || format === "csv") {
      const isCsv = format === "csv";
      const content = isCsv ? result.report.csv_content || "" : result.report.markdown;
      return new NextResponse(content, {
        headers: {
          "Content-Type": isCsv ? "text/csv; charset=utf-8" : "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename(result.report.title)}.${isCsv ? "csv" : "md"}`,
          "Cache-Control": "private, no-store"
        }
      });
    }
    const { csv_content: _csv, ...safeReport } = result.report;
    return NextResponse.json({ report: safeReport });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: "Failed to load the report." }, { status: 500 });
  }
}

/** Explicit mutation: generates a new report snapshot (history is kept). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    await requireApiPermission(request, "reports:write");
    const raw = await request.text();
    const input = generateSchema.parse(raw ? JSON.parse(raw) : {});
    const result = await generateAuditReport(id, input.reportType);
    return NextResponse.json({ report: result.report }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Choose a valid report type." }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to generate the report." }, { status: 500 });
  }
}
