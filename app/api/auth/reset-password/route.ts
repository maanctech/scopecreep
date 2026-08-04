import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requestIp } from "@/lib/auth/api";
import { assertSameOrigin, checkRateLimit, PublicError } from "@/lib/auth/security";
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

    if (error instanceof PublicError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Check the reset link and password." }, { status: 400 });
    }

    return NextResponse.json({ error: "Password reset failed." }, { status: 500 });
  }
}
