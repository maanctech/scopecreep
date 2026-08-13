import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enforceRateLimit } from "@/lib/auth/rateLimit";
import { clearRateLimitsForTests, RateLimitError } from "@/lib/auth/security";
import { isDistributedLimiterConfigured } from "@/lib/config/runtime";

beforeEach(() => clearRateLimitsForTests());

afterEach(() => vi.unstubAllEnvs());

const allows = async () => ({ success: true });
const refuses = async () => ({ success: false });

const unreachable = async () => {
  throw new Error("upstash unreachable");
};

describe("choosing where the counter lives", () => {
  it("uses the shared counter once both Upstash values are present", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "a-token");

    expect(isDistributedLimiterConfigured()).toBe(true);
  });

  it("falls back to this instance's own counter when either value is missing", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    expect(isDistributedLimiterConfigured()).toBe(false);

    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "a-token");

    expect(isDistributedLimiterConfigured()).toBe(false);
  });

  /**
   * These are the names the Vercel marketplace injects, and the Upstash client
   * reads them. A deployment provisioned that way is protected, and reporting
   * it as unprotected would send an operator looking for a problem that is not
   * there.
   */
  it("recognises the names the Vercel marketplace injects", () => {
    expect(isDistributedLimiterConfigured({
      KV_REST_API_URL: "https://example.upstash.io",
      KV_REST_API_TOKEN: "a-token"
    })).toBe(true);
  });

  /**
   * The client resolves the address and the token independently, so a
   * deployment carrying one name from each pair connects. Refusing it here
   * would report a working installation as unprotected.
   */
  it("accepts one name from each pair, as the client does", () => {
    expect(isDistributedLimiterConfigured({
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      KV_REST_API_TOKEN: "a-token"
    })).toBe(true);
  });

  it("accepts neither half on its own", () => {
    expect(isDistributedLimiterConfigured({ KV_REST_API_URL: "https://example.upstash.io" })).toBe(false);
    expect(isDistributedLimiterConfigured({ KV_REST_API_TOKEN: "a-token" })).toBe(false);
  });
});

describe("enforcing a limit against the shared counter", () => {
  it("admits a caller the shared counter accepts", async () => {
    await expect(enforceRateLimit("lead-capture:1.2.3.4", 8, 60_000, allows)).resolves.toBeUndefined();
  });

  it("refuses a caller the shared counter has seen too often", async () => {
    await expect(enforceRateLimit("lead-capture:1.2.3.4", 8, 60_000, refuses)).rejects.toThrow(RateLimitError);
  });

  /**
   * An unreachable counter must not take the endpoint down with it, and must
   * not leave the endpoint unlimited either. The local counter is weaker than
   * the shared one, which is the right thing to be left holding.
   */
  it("keeps limiting from this instance when the shared counter cannot be reached", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(enforceRateLimit("lead-capture:5.6.7.8", 3, 60_000, unreachable)).resolves.toBeUndefined();
    }

    await expect(enforceRateLimit("lead-capture:5.6.7.8", 3, 60_000, unreachable)).rejects.toThrow(RateLimitError);
  });
});

describe("enforcing a limit with no shared counter configured", () => {
  it("refuses a caller once this instance has seen the limit", async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(enforceRateLimit("audit-request:9.9.9.9", 2, 60_000, null)).resolves.toBeUndefined();
    }

    await expect(enforceRateLimit("audit-request:9.9.9.9", 2, 60_000, null)).rejects.toThrow(RateLimitError);
  });

  it("counts each caller separately", async () => {
    await enforceRateLimit("audit-request:1.1.1.1", 1, 60_000, null);

    await expect(enforceRateLimit("audit-request:2.2.2.2", 1, 60_000, null)).resolves.toBeUndefined();
    await expect(enforceRateLimit("audit-request:1.1.1.1", 1, 60_000, null)).rejects.toThrow(RateLimitError);
  });
});
