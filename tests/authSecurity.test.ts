import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasPermission } from "@/lib/auth/authorization";
import { assertSameOrigin, InvalidOriginError } from "@/lib/auth/security";
import { proxy } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

describe("organization authorization", () => {
  it("keeps read-only users from changing billing decisions", () => {
    expect(hasPermission("Read Only", "billing:read")).toBe(true);
    expect(hasPermission("Read Only", "billing:write")).toBe(false);
    expect(hasPermission("Read Only", "leads:read")).toBe(false);
    expect(hasPermission("Reviewer", "billing:write")).toBe(true);
    expect(hasPermission("Reviewer", "leads:write")).toBe(false);
    expect(hasPermission("Admin", "integrations:write")).toBe(true);
    expect(hasPermission("Admin", "leads:write")).toBe(true);
  });
});

describe("same-origin mutation defense", () => {
  it("accepts a matching origin and host", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://scopeledger.test/api", {
          method: "POST",
          headers: { host: "scopeledger.test", origin: "http://scopeledger.test" }
        })
      )
    ).not.toThrow();
  });

  it("rejects a cross-origin mutation", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://scopeledger.test/api", {
          method: "POST",
          headers: { host: "scopeledger.test", origin: "https://attacker.test" }
        })
      )
    ).toThrow(InvalidOriginError);
  });

  /**
   * A browser omits the origin on a same-origin navigation, which is how a
   * download link reaches a route that answers with a file.
   */
  it("accepts a read that carries no origin, as a download link does", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://scopeledger.test/api/exports/x/download", {
          method: "GET",
          headers: { host: "scopeledger.test" }
        })
      )
    ).not.toThrow();
  });

  /**
   * Another site's script calling this one carries the caller's cookies. No
   * read is meant to change anything, but nothing enforces that on the route
   * that forgets, so a mismatched origin is refused on reads too.
   */
  it("rejects a read issued by another site's script", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://scopeledger.test/api/projects", {
          method: "GET",
          headers: { host: "scopeledger.test", origin: "https://attacker.test" }
        })
      )
    ).toThrow(InvalidOriginError);
  });
});

describe("runtime transport headers", () => {
  it("emits HSTS for an HTTPS installation and a bounded correlation ID", () => {
    vi.stubEnv("APP_URL", "https://scopeledger.example");
    const response = proxy(new NextRequest("https://scopeledger.example/api/health", {
      headers: { "x-correlation-id": "invalid correlation value" }
    }));

    expect(response.headers.get("strict-transport-security")).toContain("max-age=31536000");
    expect(response.headers.get("x-correlation-id")).toMatch(/^[a-f0-9-]{36}$/);
  });

  it("does not emit HSTS for the supported loopback HTTP installation", () => {
    vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
    const response = proxy(new NextRequest("http://127.0.0.1:3000/api/health"));

    expect(response.headers.has("strict-transport-security")).toBe(false);
  });
});

/**
 * A policy that blocks the sign-in widget's own network calls locks every
 * customer out, and the browser reports it only in its console. These name the
 * hosts Clerk documents as required so a tightening pass cannot quietly drop
 * one.
 */
describe("browser policy for the hosted sign-in widget", () => {
  const publishableKey = `pk_test_${Buffer.from("chief-mole-42.clerk.accounts.dev$").toString("base64")}`;

  function policyOf() {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", publishableKey);

    return proxy(new NextRequest("https://scopeledger.example/sign-in")).headers.get(
      "content-security-policy"
    ) ?? "";
  }

  it("lets the page reach the frontend API the publishable key points at", () => {
    expect(policyOf()).toContain("connect-src 'self' https://chief-mole-42.clerk.accounts.dev");
  });

  it("lets the bot-protection challenge load and run", () => {
    const policy = policyOf();

    expect(policy).toContain("frame-src 'self' https://*.protect.clerk.com https://challenges.cloudflare.com");
    expect(policy).toContain("worker-src 'self' blob:");
  });

  it("lets profile images load from Clerk's image host", () => {
    expect(policyOf()).toContain("https://img.clerk.com");
  });

  it("still refuses to be framed and still forbids plugins", () => {
    const policy = policyOf();

    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
  });
});
