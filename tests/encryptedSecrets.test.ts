import { afterEach, describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  maskedSecret,
} from "@/lib/security/secrets";

const original = process.env.SCOPELEDGER_MASTER_KEY;

afterEach(() =>
  original === undefined
    ? delete process.env.SCOPELEDGER_MASTER_KEY
    : (process.env.SCOPELEDGER_MASTER_KEY = original),
);

describe("integration secret encryption", () => {
  it("round-trips with authenticated organization context and never returns the value as a mask", () => {
    process.env.SCOPELEDGER_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptSecret("private-token", "org-1:connection-1");

    expect(encrypted.ciphertext).not.toContain("private-token");
    expect(decryptSecret(encrypted, "org-1:connection-1")).toBe(
      "private-token",
    );
    expect(() => decryptSecret(encrypted, "org-2:connection-1")).toThrow();
    expect(maskedSecret()).not.toContain("private-token");
  });

  it("fails clearly without a valid 32-byte master key", () => {
    delete process.env.SCOPELEDGER_MASTER_KEY;
    expect(() => encryptSecret("secret", "context")).toThrow(/MASTER_KEY/);
    process.env.SCOPELEDGER_MASTER_KEY =
      Buffer.from("short").toString("base64");
    expect(() => encryptSecret("secret", "context")).toThrow(/32-byte/);
  });
});
