import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasPermission } from "@/lib/auth/authorization";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";
import { assertSameOrigin, InvalidOriginError } from "@/lib/auth/security";
import { proxy } from "@/proxy";
import { requestIp } from "@/lib/auth/api";

afterEach(() => vi.unstubAllEnvs());

describe("password security", () => {
  it("rejects weak passwords", () => {
    expect(() => validatePassword("short")).toThrow(/at least 12/);
    expect(() => validatePassword("alllowercase1234")).toThrow(/uppercase/);
  });

  it("hashes and verifies strong passwords with Argon2id", async () => {
    const encoded = await hashPassword("CorrectHorse7Battery");

    expect(encoded).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(encoded, "CorrectHorse7Battery")).resolves.toBe(true);
    await expect(verifyPassword(encoded, "WrongPassword7Here")).resolves.toBe(false);
  });
});

describe("organization authorization", () => {
  it("keeps read-only users from changing billing decisions", () => {
    expect(hasPermission("Read Only", "billing:read")).toBe(true);
    expect(hasPermission("Read Only", "billing:write")).toBe(false);
    expect(hasPermission("Read Only", "leads:read")).toBe(false);
    expect(hasPermission("Reviewer", "billing:write")).toBe(true);
    expect(hasPermission("Reviewer", "communications:write")).toBe(true);
    expect(hasPermission("Reviewer", "integrations:write")).toBe(false);
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
});

describe("trusted proxy address resolution", () => {
  const request = new Request("https://scopeledger.test/api", {
    headers: { "x-forwarded-for": "198.51.100.10, 203.0.113.20" },
  });

  it("ignores spoofable forwarding headers unless proxy trust is configured", () => {
    expect(requestIp(request, { TRUSTED_PROXY_HOPS: "0" })).toBe("127.0.0.1");
  });

  it("selects the address at the configured right-hand trust boundary", () => {
    expect(requestIp(request, { TRUSTED_PROXY_HOPS: "1" })).toBe("203.0.113.20");
    expect(requestIp(request, { TRUSTED_PROXY_HOPS: "2" })).toBe("198.51.100.10");
  });

  it("fails closed for malformed or insufficient forwarding chains", () => {
    expect(requestIp(request, { TRUSTED_PROXY_HOPS: "3" })).toBe("127.0.0.1");
    expect(
      requestIp(new Request("https://scopeledger.test", { headers: { "x-forwarded-for": "spoofed" } }), {
        TRUSTED_PROXY_HOPS: "1",
      }),
    ).toBe("127.0.0.1");
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
