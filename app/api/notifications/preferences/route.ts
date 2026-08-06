import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import {
  getNotificationPreference,
  updateNotificationPreference,
} from "@/lib/notifications/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "findings:review");

    return NextResponse.json({ preference: await getNotificationPreference() });
  } catch (error) {
    const auth = authErrorResponse(error);

    if (auth) return auth;

    return NextResponse.json({ error: "Unable to load notification settings." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireApiPermission(request, "findings:review");

    return NextResponse.json({
      preference: await updateNotificationPreference(await request.json()),
    });
  } catch (error) {
    const auth = authErrorResponse(error);

    if (auth) return auth;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update notification settings." },
      { status: error instanceof z.ZodError ? 400 : 422 },
    );
  }
}
