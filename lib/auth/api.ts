import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { AuthorizationError, assertPermission } from "@/lib/auth/authorization";
import { isTestRuntime } from "@/lib/config/runtime";
import { getAuthContext } from "@/lib/auth/service";
import { assertSameOrigin, checkRateLimit, InvalidOriginError, RateLimitError } from "@/lib/auth/security";
import type { AuthContext, Permission } from "@/lib/auth/types";
import { SESSION_COOKIE_NAME } from "@/lib/auth/current";

export class AuthenticationError extends Error {}

function cookieValue(header: string | null, name: string) {
  const item = header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}

export async function requireApiPermission(
  request: Request,
  permission: Permission
): Promise<AuthContext | null> {
  assertSameOrigin(request);

  if (isTestRuntime()) return null;

  const token = cookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME);

  if (!["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    const path = new URL(request.url).pathname;
    const principal = token
      ? createHash("sha256").update(token).digest("hex").slice(0, 24)
      : requestIp(request);

    checkRateLimit(`protected:${principal}:${path}`, 120, 60_000);
  }

  const context = token ? await getAuthContext(token) : null;

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

  return null;
}

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
