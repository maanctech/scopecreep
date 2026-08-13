import { verifyToken } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { CLERK_SESSION_COOKIE_NAME } from "@/lib/auth/clerkCookie";
import { sessionFromClaims, type ClerkSession } from "@/lib/auth/clerkIdentity";

export { CLERK_SESSION_COOKIE_NAME };

export type ClaimsVerifier = (token: string) => Promise<Record<string, unknown>>;

function secretKey() {
  const value = process.env.CLERK_SECRET_KEY?.trim();

  if (!value) throw new Error("CLERK_SECRET_KEY is required to verify a session.");

  return value;
}

/**
 * Naming the parties that may present a token stops a session minted for one
 * deployment from being replayed against another that shares the instance.
 */
function authorizedParties() {
  const origin = process.env.APP_URL?.trim();

  return origin ? [origin] : undefined;
}

const clerkVerifier: ClaimsVerifier = async (token) =>
  verifyToken(token, { secretKey: secretKey(), authorizedParties: authorizedParties() });

let verifierOverride: ClaimsVerifier | undefined;

/**
 * Test-only seam. Verifying for real would need Clerk's signing keys and a
 * network round trip, which no test should depend on; production never calls
 * this, so the live path is unaffected.
 */
export function setClaimsVerifierForTesting(verify: ClaimsVerifier) {
  verifierOverride = verify;
}

export function resetClaimsVerifierForTesting() {
  verifierOverride = undefined;
}

function activeVerifier(verify?: ClaimsVerifier) {
  return verify ?? verifierOverride ?? clerkVerifier;
}

/**
 * A token that fails verification is nobody, not an error. Expiry is the
 * ordinary end of a working day, and a caller that has to distinguish expiry
 * from forgery would be tempted to treat one of them as signed in.
 */
export async function sessionFromToken(
  token: string | null | undefined,
  verify?: ClaimsVerifier
): Promise<ClerkSession | null> {
  if (!token) return null;

  try {
    return sessionFromClaims(await activeVerifier(verify)(token));
  } catch {
    return null;
  }
}

export function requestToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim() || null;

  const item = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CLERK_SESSION_COOKIE_NAME}=`));

  return item ? decodeURIComponent(item.slice(CLERK_SESSION_COOKIE_NAME.length + 1)) : null;
}

export async function cookieSession(verify?: ClaimsVerifier) {
  return sessionFromToken((await cookies()).get(CLERK_SESSION_COOKIE_NAME)?.value, verify);
}

export async function requestSession(request: Request, verify?: ClaimsVerifier) {
  return sessionFromToken(requestToken(request), verify);
}
