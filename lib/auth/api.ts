import { NextResponse } from "next/server";
import { AuthorizationError, assertPermission } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/service";
import { assertSameOrigin, InvalidOriginError, RateLimitError } from "@/lib/auth/security";
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
  if (process.env.NODE_ENV === "test") return null;

  const token = cookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME);
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
