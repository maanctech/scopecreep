import { NextResponse } from "next/server";
import { getFindingDetail } from "@/lib/store";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    await requireApiPermission(request, "billing:read");
    const detail = await getFindingDetail(id);

    if (!detail) {
      return NextResponse.json({ error: "Finding not found." }, { status: 404 });
    }

    return NextResponse.json({ events: detail.events });
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) return authResponse;

    return NextResponse.json({ error: "Failed to load billing events." }, { status: 500 });
  }
}
