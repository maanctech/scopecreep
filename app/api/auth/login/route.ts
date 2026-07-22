import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requestIp } from "@/lib/auth/api";
import { setSessionCookie } from "@/lib/auth/cookies";
import { assertSameOrigin, checkRateLimit } from "@/lib/auth/security";
import { authenticateUser, createSession } from "@/lib/auth/service";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(256)
}).strict();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ip = requestIp(request);
    checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
    const body = schema.parse(await request.json());
    const userId = await authenticateUser(body.email, body.password);
    if (!userId) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    const session = await createSession({
      userId,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent")
    });
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    }
    return NextResponse.json({ error: "Sign in failed. Try again." }, { status: 500 });
  }
}
