import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, shouldUseSecureSessionCookie } from "@/lib/auth/sessionConfig";
import { AUDIT_INTAKE_COOKIE_NAME } from "@/lib/publicIntake";

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
    path: "/",
    expires: expiresAt
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
    path: "/",
    expires: new Date(0)
  });
}

export function setAuditIntakeCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set(AUDIT_INTAKE_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
    path: "/",
    expires: expiresAt,
  });
}

export function clearAuditIntakeCookie(response: NextResponse) {
  response.cookies.set(AUDIT_INTAKE_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
    path: "/",
    expires: new Date(0),
  });
}
