import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/auth/authorization";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";
import { assertSameOrigin, InvalidOriginError } from "@/lib/auth/security";

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
