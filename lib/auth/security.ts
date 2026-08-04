import { timingSafeEqual } from "node:crypto";
import { isTestRuntime } from "@/lib/config/runtime";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function assertSameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return;

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    if (isTestRuntime()) return;

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

/**
 * Carries a message that is deliberately safe to show an unauthenticated
 * caller. Anything else thrown out of an auth route is treated as internal and
 * replaced with a generic message, so database and runtime detail never leaks.
 */
export class PublicError extends Error {}

type RateEntry = { count: number; resetsAt: number };
const rateLimits = new Map<string, RateEntry>();
const SWEEP_INTERVAL_MS = 60_000;
const SWEEP_SIZE_THRESHOLD = 10_000;
let nextSweepAt = 0;

/**
 * Keys embed a client-supplied forwarding header, so an attacker can mint
 * unlimited distinct ones. Entries for keys that never recur would otherwise
 * stay in the map forever and grow it without bound. The size trigger matters
 * as much as the clock: a fast attacker can add far more entries between two
 * timed sweeps than the interval alone would suggest.
 */
function dropExpiredEntries(currentTime: number) {
  if (currentTime < nextSweepAt && rateLimits.size < SWEEP_SIZE_THRESHOLD) return;

  nextSweepAt = currentTime + SWEEP_INTERVAL_MS;

  for (const [key, entry] of rateLimits) {
    if (entry.resetsAt <= currentTime) rateLimits.delete(key);
  }
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const currentTime = Date.now();

  dropExpiredEntries(currentTime);
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
  nextSweepAt = 0;
}

export function rateLimitEntryCountForTests() {
  return rateLimits.size;
}
