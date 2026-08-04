import { NextResponse } from "next/server";
import { z } from "zod";
import { setSessionCookie } from "@/lib/auth/cookies";
import { checkRateLimit } from "@/lib/auth/security";
import { createInitialOwner, createSession, hasAnyUsers } from "@/lib/auth/service";
import { authErrorResponse, requestIp } from "@/lib/auth/api";
import { assertSameOrigin, PublicError } from "@/lib/auth/security";

export const runtime = "nodejs";

const schema = z.object({
  organizationName: z.string().trim().min(2).max(160),
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(12).max(256)
}).strict();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    checkRateLimit(`setup:${requestIp(request)}`, 5, 15 * 60 * 1000);

    if (await hasAnyUsers()) {
      return NextResponse.json({ error: "Initial setup has already been completed." }, { status: 409 });
    }

    const input = schema.parse(await request.json());
    const owner = await createInitialOwner(input);
    const session = await createSession({
      userId: owner.userId,
      organizationId: owner.organizationId,
      ipAddress: requestIp(request),
      userAgent: request.headers.get("user-agent")
    });
    const response = NextResponse.json({ ok: true }, { status: 201 });

    setSessionCookie(response, session.token, session.expiresAt);

    return response;
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) return authResponse;

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid setup details." }, { status: 400 });
    }

    if (error instanceof PublicError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Setup failed." }, { status: 500 });
  }
}
