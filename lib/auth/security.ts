import { timingSafeEqual } from "node:crypto";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function assertSameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return;

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) {
    if (process.env.NODE_ENV === "test") return;
    throw new InvalidOriginError("This request is missing same-origin headers.");
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new InvalidOriginError("This request has an invalid origin.");
  }

  const expected = Buffer.from(host);
  const actual = Buffer.from(originHost);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new InvalidOriginError("Cross-origin mutation rejected.");
  }
}

export class InvalidOriginError extends Error {}

type RateEntry = { count: number; resetsAt: number };
const rateLimits = new Map<string, RateEntry>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const currentTime = Date.now();
  const existing = rateLimits.get(key);
  if (!existing || existing.resetsAt <= currentTime) {
    rateLimits.set(key, { count: 1, resetsAt: currentTime + windowMs });
    return;
  }
  if (existing.count >= limit) throw new RateLimitError("Too many attempts. Try again later.");
  existing.count += 1;
}

export class RateLimitError extends Error {}

export function clearRateLimitsForTests() {
  rateLimits.clear();
}
