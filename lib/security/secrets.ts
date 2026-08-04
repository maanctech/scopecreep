import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedValue = {
  ciphertext: string;
  initializationVector: string;
  authTag: string;
};

function masterKey() {
  const encoded = process.env.SCOPELEDGER_MASTER_KEY?.trim();

  if (!encoded)
    throw new Error(
      "SCOPELEDGER_MASTER_KEY is required for integration credentials.",
    );

  const key = Buffer.from(encoded, "base64");

  if (key.length !== 32)
    throw new Error(
      "SCOPELEDGER_MASTER_KEY must be a base64-encoded 32-byte key.",
    );

  return key;
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
  const decipher = createDecipheriv(
    "aes-256-gcm",
    masterKey(),
    Buffer.from(value.initializationVector, "base64"),
  );

  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskedSecret() {
  return "Saved securely - replace or revoke";
}
