import { NextResponse } from "next/server";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { getSowOriginal } from "@/lib/sow/service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    await requireApiPermission(request, "projects:read");
    const { id, versionId } = await params;
    const original = await getSowOriginal(id, versionId);

    if (!original) return NextResponse.json({ error: "No original document is stored for this SOW version." }, { status: 404 });

    return new Response(original.stream, {
      headers: {
        "Content-Type": original.mediaType,
        "Content-Length": String(original.byteSize),
        "Content-Disposition": `attachment; filename="${original.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "The original document could not be read." }, { status: 500 });
  }
}
