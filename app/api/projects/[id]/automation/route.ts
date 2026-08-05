import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import {
  getProjectAutomation,
  updateProjectAutomation,
} from "@/lib/automation/service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiPermission(request, "projects:read");
    const { id } = await params;

    return NextResponse.json({ automation: await getProjectAutomation(id) });
  } catch (error) {
    const auth = authErrorResponse(error);

    if (auth) return auth;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load monitoring." },
      { status: 404 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiPermission(request, "integrations:write");
    const { id } = await params;
    const automation = await updateProjectAutomation(id, await request.json());

    return NextResponse.json({ automation });
  } catch (error) {
    const auth = authErrorResponse(error);

    if (auth) return auth;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update monitoring." },
      { status: error instanceof z.ZodError ? 400 : 422 },
    );
  }
}
