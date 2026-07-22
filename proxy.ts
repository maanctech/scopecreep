import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/sessionConfig";

function applyRuntimeHeaders(response: NextResponse, correlationId: string) {
  response.headers.set("x-correlation-id", correlationId);
  if (process.env.APP_URL?.startsWith("https://")) {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return response;
}

export function proxy(request: NextRequest) {
  const suppliedCorrelationId = request.headers.get("x-correlation-id") || "";
  const correlationId = /^[A-Za-z0-9._-]{1,128}$/.test(suppliedCorrelationId)
    ? suppliedCorrelationId
    : crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-correlation-id", correlationId);
  const protectedPage = ["/account", "/app", "/admin", "/sales-assets"].some(
    (path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`)
  );
  if (protectedPage && !request.cookies.has(SESSION_COOKIE_NAME)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    const response = NextResponse.redirect(login);
    return applyRuntimeHeaders(response, correlationId);
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return applyRuntimeHeaders(response, correlationId);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
