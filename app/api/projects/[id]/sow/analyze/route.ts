import { NextResponse } from "next/server";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { generateSowReview } from "@/lib/sow/service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission(request, "projects:write");
    const { id } = await params;
    return NextResponse.json(await generateSowReview(id), { status: 201 });
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: error instanceof Error && /reliable boundary map|active SOW/.test(error.message) ? error.message : "The SOW review could not be generated. Check AI Status and try again." }, { status: 422 });
  }
}
