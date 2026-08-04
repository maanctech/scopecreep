import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { changePassword } from "@/lib/auth/service";

const schema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(256)
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireApiPermission(request, "settings:read");

    if (!context) return NextResponse.json({ error: "Unavailable in test mode." }, { status: 400 });

    const body = schema.parse(await request.json());

    await changePassword({
      userId: context.userId,
      keepSessionId: context.sessionId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) return authResponse;

    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Check the password fields and try again." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Password update failed." },
      { status: 400 }
    );
  }
}
