import { NextResponse } from "next/server";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { markNotificationRead } from "@/lib/notifications/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiPermission(request, "findings:review");
    const { id } = await params;

    return NextResponse.json(await markNotificationRead(id));
  } catch (error) {
    const auth = authErrorResponse(error);

    if (auth) return auth;

    return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  }
}
