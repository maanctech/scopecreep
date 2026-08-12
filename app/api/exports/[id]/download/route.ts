import { NextResponse } from "next/server";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { downloadDataExport } from "@/lib/exports/service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission(request, "settings:write");
    const { id } = await params;
    const download = await downloadDataExport(id);

    if (!download) return NextResponse.json({ error: "That export is not available. It may have expired." }, { status: 404 });

    return new Response(download.stream, {
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(download.byteSize),
        "Content-Disposition": `attachment; filename="${download.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "The export could not be read." }, { status: 500 });
  }
}
