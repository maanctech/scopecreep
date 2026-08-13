import { NextResponse, type NextRequest } from "next/server";
import { CLERK_SESSION_COOKIE_NAME } from "@/lib/auth/clerkCookie";
import { frontendApiOrigin } from "@/lib/auth/clerkFrontendApi";

/**
 * Built per request because the nonce must be unpredictable and single-use.
 * `strict-dynamic` means the host allowlist is ignored for scripts: only the
 * nonced bootstrap runs, plus whatever it loads itself. That is what makes an
 * injected `<script>` inert even when it reaches the page.
 *
 * `style-src` keeps `unsafe-inline`. Next and React both emit inline style
 * attributes that carry no nonce, and injected CSS cannot execute — the
 * exposure it leaves is far smaller than the breakage removing it causes.
 */
const CLERK_PROTECTION = "https://*.protect.clerk.com";
const TURNSTILE = "https://challenges.cloudflare.com";

function contentSecurityPolicy(nonce: string) {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const frontendApi = frontendApiOrigin(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const clerkHosts = [frontendApi, CLERK_PROTECTION].filter(Boolean).join(" ");
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${clerkHosts} ${TURNSTILE}${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://img.clerk.com",
    "font-src 'self' data:",
    `connect-src 'self' ${clerkHosts}`,
    "worker-src 'self' blob:",
    `frame-src 'self' ${CLERK_PROTECTION} ${TURNSTILE}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ];

  if (process.env.APP_URL?.startsWith("https://")) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

function applyRuntimeHeaders(response: NextResponse, correlationId: string, policy: string) {
  response.headers.set("x-correlation-id", correlationId);
  response.headers.set("Content-Security-Policy", policy);

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
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-correlation-id", correlationId);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const protectedPage = ["/account", "/app", "/admin", "/sales-assets"].some(
    (path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`)
  );

  if (protectedPage && !request.cookies.has(CLERK_SESSION_COOKIE_NAME)) {
    const signIn = new URL("/sign-in", request.url);

    signIn.searchParams.set("redirect_url", request.nextUrl.pathname);
    const response = NextResponse.redirect(signIn);

    return applyRuntimeHeaders(response, correlationId, policy);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  return applyRuntimeHeaders(response, correlationId, policy);
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" }
      ]
    }
  ]
};
