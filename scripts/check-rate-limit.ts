import { randomUUID } from "node:crypto";
import { distributedLimiterFor } from "../lib/auth/rateLimit";
import { isDistributedLimiterConfigured } from "../lib/config/runtime";

const LIMIT = 3;
const WINDOW_MS = 60_000;
const ATTEMPTS = LIMIT + 2;

function reportMissingCredentials() {
  console.error("The shared rate limit counter is not configured, so each running instance counts on its own.");
  console.error(`UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? "set" : "missing"}`);
  console.error(`UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? "set" : "missing"}`);

  if (process.env.KV_REST_API_URL || process.env.KV_REST_API_TOKEN) {
    console.error("");
    console.error("KV_REST_API_URL or KV_REST_API_TOKEN is set instead. Those are the names the Vercel");
    console.error("marketplace injects. Copy their values to the UPSTASH_REDIS_REST_ names as well.");
  }
}

/**
 * Counting through enforceRateLimit would prove nothing: an unreachable Redis
 * falls back to the in-process counter, which enforces the same limit within a
 * single run. The shared counter is called directly so a failure reaching it is
 * a failure here.
 */
async function main() {
  if (!isDistributedLimiterConfigured()) {
    reportMissingCredentials();
    process.exit(1);
  }

  const limiter = distributedLimiterFor(LIMIT, WINDOW_MS);

  if (!limiter) {
    reportMissingCredentials();
    process.exit(1);
  }

  console.log(`Counting ${ATTEMPTS} attempts against a limit of ${LIMIT} per ${WINDOW_MS}ms...`);
  const key = `check:${randomUUID()}`;
  const startedAt = Date.now();
  let allowed = 0;

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const callStartedAt = Date.now();
    const { success } = await limiter(key);

    console.log(`  attempt ${attempt + 1}: ${success ? "allowed" : "refused"} in ${Date.now() - callStartedAt}ms`);

    if (success) allowed += 1;
  }

  console.log(`Allowed ${allowed} of ${ATTEMPTS} in ${Date.now() - startedAt}ms.`);

  if (allowed !== LIMIT) {
    console.error(`The shared counter answered but allowed ${allowed} attempts where ${LIMIT} was expected.`);
    process.exit(1);
  }

  console.log("The shared counter is reachable and enforcing the limit.");
}

main().catch((error) => {
  console.error("Could not reach the shared rate limit counter.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
