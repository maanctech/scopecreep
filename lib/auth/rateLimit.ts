import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { checkRateLimit, RateLimitError } from "@/lib/auth/security";
import { isDistributedLimiterConfigured } from "@/lib/config/runtime";

export type RemoteLimiter = (key: string) => Promise<{ success: boolean }>;

const limiters = new Map<string, Ratelimit>();
let redis: Redis | undefined;

function upstashLimiter(limit: number, windowMs: number) {
  const signature = `${limit}:${windowMs}`;
  const existing = limiters.get(signature);

  if (existing) return existing;

  redis ??= Redis.fromEnv();
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    prefix: "scopeledger:rate"
  });

  limiters.set(signature, limiter);

  return limiter;
}

export function distributedLimiterFor(limit: number, windowMs: number): RemoteLimiter | null {
  if (!isDistributedLimiterConfigured()) return null;

  return (key) => upstashLimiter(limit, windowMs).limit(key);
}

/**
 * A counter held in one process is a counter each running instance keeps its
 * own copy of, so the limit an attacker meets is the configured one multiplied
 * by however many instances happen to be warm. The shared counter is the real
 * limit; the in-process one remains as what is left when the shared counter is
 * unreachable, because an outage there should weaken the limit rather than
 * either remove it or take the endpoint down.
 */
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  remote: RemoteLimiter | null = distributedLimiterFor(limit, windowMs)
) {
  if (!remote) return checkRateLimit(key, limit, windowMs);

  try {
    const { success } = await remote(key);

    if (!success) throw new RateLimitError("Too many attempts. Try again later.");

    return;
  } catch (error) {
    if (error instanceof RateLimitError) throw error;

    return checkRateLimit(key, limit, windowMs);
  }
}
