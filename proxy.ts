import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/sessionConfig";

export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/app/:path*", "/admin/:path*", "/sales-assets/:path*"]
};
