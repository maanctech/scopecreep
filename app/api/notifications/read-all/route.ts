import { NextResponse } from "next/server";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { markAllNotificationsRead } from "@/lib/notifications/service";

export async function POST(request: Request) {
  try {
    await requireApiPermission(request, "findings:review");

    return NextResponse.json(await markAllNotificationsRead());
  } catch (error) {
    const auth = authErrorResponse(error);

    if (auth) return auth;

    return NextResponse.json({ error: "Unable to update notifications." }, { status: 500 });
  }
}
