import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { AuthorizationError, assertPermission } from "@/lib/auth/authorization";
import { isTestRuntime } from "@/lib/config/runtime";
import { authContextForSession, EmailAlreadyClaimedError } from "@/lib/auth/clerkProvisioning";
import { requestToken, sessionFromToken } from "@/lib/auth/clerkSession";
import { assertSameOrigin, InvalidOriginError, RateLimitError } from "@/lib/auth/security";
import { enforceRateLimit } from "@/lib/auth/rateLimit";
import type { AuthContext, Permission } from "@/lib/auth/types";

export class AuthenticationError extends Error {}

export async function requireApiPermission(
  request: Request,
  permission: Permission
): Promise<AuthContext | null> {
  assertSameOrigin(request);

  if (isTestRuntime()) return null;

  const token = requestToken(request);

  if (!["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    const path = new URL(request.url).pathname;
    const principal = token
      ? createHash("sha256").update(token).digest("hex").slice(0, 24)
      : requestIp(request);

    await enforceRateLimit(`protected:${principal}:${path}`, 120, 60_000);
  }

  const session = await sessionFromToken(token);
  const context = session ? await authContextForSession(session) : null;

  if (!context) throw new AuthenticationError("Sign in to continue.");

  assertPermission(context.role, permission);

  return context;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  }

  if (error instanceof InvalidOriginError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json({ error: error.message }, { status: 429 });
  }

  /**
   * Not 500: the request is well formed and the caller is who they say they
   * are. Two accounts claim one address, and only a person can decide which of
   * them should keep it.
   */
  if (error instanceof EmailAlreadyClaimedError) {
    return NextResponse.json(
      { error: "An account already exists for this email address. Contact your administrator to link it." },
      { status: 409 }
    );
  }

  return null;
}

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
