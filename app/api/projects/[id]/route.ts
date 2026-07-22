import { NextResponse } from "next/server";
import { getProjectDetail } from "@/lib/store";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission(request, "projects:read");
    const { id } = await context.params;
    const project = await getProjectDetail(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Failed to load project." }, { status: 500 });
  }
}
