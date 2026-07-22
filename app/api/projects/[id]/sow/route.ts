import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { extractSowFile, MAX_SOW_FILE_BYTES } from "@/lib/sow/extraction";
import { createSowVersion, getSowWorkspace } from "@/lib/sow/service";

export const runtime = "nodejs";

const pasteSchema = z.object({ text: z.string().trim().min(40).max(500_000), changeNote: z.string().trim().max(500).optional().nullable() }).strict();

function safeError(error: unknown) {
  if (error instanceof z.ZodError) return "Provide at least 40 characters and no more than 500,000 characters.";
  if (error instanceof Error && /empty|10 MB|TXT, DOCX|scanned|readable text|filename|40 characters|500,000/.test(error.message)) return error.message;
  return "The SOW version could not be saved. Check the document and try again.";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission(request, "projects:read");
    const { id } = await params;
    const workspace = await getSowWorkspace(id);
    return workspace ? NextResponse.json({ workspace }) : NextResponse.json({ error: "Project not found." }, { status: 404 });
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Failed to load the SOW workspace." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission(request, "projects:write");
    const { id } = await params;
    const contentType = request.headers.get("content-type") || "";
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_SOW_FILE_BYTES + 1_000_000) {
      return NextResponse.json({ error: "SOW uploads must be 10 MB or smaller." }, { status: 413 });
    }
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "Select a TXT, DOCX, or PDF file." }, { status: 400 });
      if (file.size > MAX_SOW_FILE_BYTES) return NextResponse.json({ error: "SOW files must be 10 MB or smaller." }, { status: 413 });
      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractSowFile({ buffer, filename: file.name, mediaType: file.type });
      const result = await createSowVersion({ projectId: id, text: extracted.text, changeNote: String(form.get("changeNote") || "") || null, extracted, fileBuffer: buffer });
      return NextResponse.json(result, { status: 201 });
    }
    const body = pasteSchema.parse(await request.json());
    const result = await createSowVersion({ projectId: id, text: body.text, changeNote: body.changeNote });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error);
    return auth || NextResponse.json({ error: safeError(error) }, { status: error instanceof z.ZodError ? 400 : 422 });
  }
}
