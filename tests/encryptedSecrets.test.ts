import { afterEach, describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  maskedSecret,
} from "@/lib/security/secrets";

const original = process.env.SCOPELEDGER_MASTER_KEY;
const originalPrevious = process.env.SCOPELEDGER_PREVIOUS_MASTER_KEY;

afterEach(() => {
  if (original === undefined) delete process.env.SCOPELEDGER_MASTER_KEY;
  else process.env.SCOPELEDGER_MASTER_KEY = original;

  if (originalPrevious === undefined) delete process.env.SCOPELEDGER_PREVIOUS_MASTER_KEY;
  else process.env.SCOPELEDGER_PREVIOUS_MASTER_KEY = originalPrevious;
});

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

  it("still reads secrets written under the previous key while rotating", () => {
    const retiredKey = Buffer.alloc(32, 7).toString("base64");
    const currentKey = Buffer.alloc(32, 9).toString("base64");

    process.env.SCOPELEDGER_MASTER_KEY = retiredKey;
    const writtenBeforeRotation = encryptSecret("legacy-token", "org-1:connection-1");

    process.env.SCOPELEDGER_MASTER_KEY = currentKey;
    delete process.env.SCOPELEDGER_PREVIOUS_MASTER_KEY;

    // Without the retired key configured the old ciphertext is unreadable.
    expect(() => decryptSecret(writtenBeforeRotation, "org-1:connection-1")).toThrow();

    process.env.SCOPELEDGER_PREVIOUS_MASTER_KEY = retiredKey;
    expect(decryptSecret(writtenBeforeRotation, "org-1:connection-1")).toBe("legacy-token");

    // New writes use the current key and stay readable once the retired key goes.
    const writtenAfterRotation = encryptSecret("fresh-token", "org-1:connection-1");

    delete process.env.SCOPELEDGER_PREVIOUS_MASTER_KEY;
    expect(decryptSecret(writtenAfterRotation, "org-1:connection-1")).toBe("fresh-token");
  });

  it("still rejects a tampered value when a previous key is configured", () => {
    process.env.SCOPELEDGER_MASTER_KEY = Buffer.alloc(32, 9).toString("base64");
    process.env.SCOPELEDGER_PREVIOUS_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptSecret("private-token", "org-1:connection-1");

    expect(() =>
      decryptSecret({ ...encrypted, ciphertext: Buffer.from("tampered").toString("base64") }, "org-1:connection-1")
    ).toThrow();
  });
});
