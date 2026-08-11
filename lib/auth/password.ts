import { hash, verify, type Options } from "@node-rs/argon2";
import { MIN_PASSWORD_LENGTH } from "@/constants/typescript/auth";
import { PublicError } from "@/lib/auth/security";

const options: Options = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 3,
  parallelism: 1,
  outputLen: 32
};

export { MIN_PASSWORD_LENGTH };

export function validatePassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new PublicError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  if (password.length > 256) throw new PublicError("Password must be 256 characters or fewer.");

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new PublicError("Password must include an uppercase letter, lowercase letter, and number.");
  }
}

export async function hashPassword(password: string) {
  validatePassword(password);

  return hash(password, options);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password, options);
  } catch {
    return false;
  }
}
