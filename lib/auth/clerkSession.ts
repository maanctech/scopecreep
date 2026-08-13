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
 * A replacement verifier is the one thing here that could accept a token Clerk
 * never signed, so it is refused outright on a production server rather than
 * left to the fact that nothing currently calls it. The fence is production
 * rather than the test-runner marker the authentication bypass uses, because
 * the suites that exercise the real session path deliberately remove that
 * marker and still need to install a verifier.
 */
function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

export function setClaimsVerifierForTesting(verify: ClaimsVerifier) {
  if (isProductionRuntime()) throw new Error("The claims verifier cannot be replaced on a production server.");

  verifierOverride = verify;
}

export function resetClaimsVerifierForTesting() {
  verifierOverride = undefined;
}

function activeVerifier(verify?: ClaimsVerifier) {
  if (verify) return verify;

  if (verifierOverride && !isProductionRuntime()) return verifierOverride;

  return clerkVerifier;
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

/**
 * More than one session cookie means somebody else placed one, since a cookie
 * set for a parent domain arrives alongside our own and nothing in the header
 * says which is which. Taking the first would let whoever set it decide who the
 * caller is, so an ambiguous request carries no session at all: being signed
 * out is recoverable, being signed in as somebody else's account is not.
 */
function onlySessionCookie(values: string[]) {
  return values.length === 1 ? values[0] : null;
}

export function requestToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim() || null;

  const prefix = `${CLERK_SESSION_COOKIE_NAME}=`;
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix))
    .map((part) => decodeURIComponent(part.slice(prefix.length)));

  return onlySessionCookie(values);
}

export async function cookieSession(verify?: ClaimsVerifier) {
  const present = (await cookies()).getAll(CLERK_SESSION_COOKIE_NAME).map((cookie) => cookie.value);

  return sessionFromToken(onlySessionCookie(present), verify);
}

export async function requestSession(request: Request, verify?: ClaimsVerifier) {
  return sessionFromToken(requestToken(request), verify);
}
