import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requestIp } from "@/lib/auth/api";
import { assertSameOrigin, checkRateLimit } from "@/lib/auth/security";
import { resetPassword } from "@/lib/auth/service";

const schema = z.object({
  token: z.string().min(20).max(200),
  newPassword: z.string().min(12).max(256)
}).strict();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    checkRateLimit(`password-reset:${requestIp(request)}`, 10, 30 * 60 * 1000);
    const body = schema.parse(await request.json());

    await resetPassword(body.token, body.newPassword);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) return authResponse;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Password reset failed." },
      { status: 400 }
    );
  }
}
