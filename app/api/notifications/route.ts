import { NextResponse } from "next/server";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { listProfessionalNotifications } from "@/lib/notifications/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "findings:review");

    return NextResponse.json({ notifications: await listProfessionalNotifications() });
  } catch (error) {
    const auth = authErrorResponse(error);

    if (auth) return auth;

    return NextResponse.json(
      { error: "Unable to load professional notifications." },
      { status: 500 },
    );
  }
}
