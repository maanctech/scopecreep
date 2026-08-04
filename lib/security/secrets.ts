import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedValue = {
  ciphertext: string;
  initializationVector: string;
  authTag: string;
};

function decodeKey(encoded: string, name: string) {
  const key = Buffer.from(encoded, "base64");

  if (key.length !== 32)
    throw new Error(`${name} must be a base64-encoded 32-byte key.`);

  return key;
}

function masterKey() {
  const encoded = process.env.SCOPELEDGER_MASTER_KEY?.trim();

  if (!encoded)
    throw new Error(
      "SCOPELEDGER_MASTER_KEY is required for integration credentials.",
    );

  return decodeKey(encoded, "SCOPELEDGER_MASTER_KEY");
}

/**
 * Decryption keys in priority order. The previous key exists only so a
 * compromised master key can actually be replaced: set it to the old value,
 * restart, and every stored secret re-encrypts under the new key the next time
 * it is written. Encryption always uses the current key.
 */
function decryptionKeys() {
  const keys = [masterKey()];
  const previous = process.env.SCOPELEDGER_PREVIOUS_MASTER_KEY?.trim();

  if (previous) keys.push(decodeKey(previous, "SCOPELEDGER_PREVIOUS_MASTER_KEY"));

  return keys;
}

export function encryptSecret(value: string, context: string): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);

  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    initializationVector: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(value: EncryptedValue, context: string) {
  const keys = decryptionKeys();

  for (const [index, key] of keys.entries()) {
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(value.initializationVector, "base64"),
      );

      decipher.setAAD(Buffer.from(context));
      decipher.setAuthTag(Buffer.from(value.authTag, "base64"));

      return Buffer.concat([
        decipher.update(Buffer.from(value.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } catch (error) {
      // The GCM tag makes a wrong key indistinguishable from tampering, so the
      // only way to tell them apart is to try the next key. Once none are left
      // the failure is real.
      if (index === keys.length - 1) throw error;
    }
  }

  throw new Error("No configured master key could decrypt this secret.");
}

export function maskedSecret() {
  return "Saved securely - replace or revoke";
}
