import { NextResponse } from "next/server";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { getReportVersion, NotFoundError } from "@/lib/store";

function filename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "scopeledger-report";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    await requireApiPermission(request, "reports:read");
    const { id, versionId } = await params;
    const report = await getReportVersion(id, versionId);

    if (!report) return NextResponse.json({ error: "Report version not found." }, { status: 404 });

    const format = new URL(request.url).searchParams.get("format");

    if (format === "markdown" || format === "csv") {
      const isCsv = format === "csv";

      return new NextResponse(isCsv ? report.csv_content || "" : report.markdown, {
        headers: {
          "Content-Type": isCsv ? "text/csv; charset=utf-8" : "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename(report.title)}-v${report.version_number}.${isCsv ? "csv" : "md"}`,
          "Cache-Control": "private, no-store"
        }
      });
    }

    const { csv_content: _csv, ...safeReport } = report;

    return NextResponse.json({ report: safeReport });
  } catch (error) {
    const auth = authErrorResponse(error);

    if (auth) return auth;

    if (error instanceof NotFoundError) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    return NextResponse.json({ error: "Failed to load the report version." }, { status: 500 });
  }
}
