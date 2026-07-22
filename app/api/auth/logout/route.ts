import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/auth/security";
import { clearSessionCookie } from "@/lib/auth/cookies";
import { revokeSession } from "@/lib/auth/service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/sessionConfig";

function cookieValue(header: string | null) {
  const item = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  return item ? decodeURIComponent(item.slice(SESSION_COOKIE_NAME.length + 1)) : null;
}

export async function POST(request: Request) {
  assertSameOrigin(request);
  const token = cookieValue(request.headers.get("cookie"));
  if (token) await revokeSession(token);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
