import { createHash, randomBytes } from "node:crypto";

export const AUDIT_INTAKE_COOKIE_NAME = "scopeledger_audit_intake";
export const AUDIT_INTAKE_TTL_MS = 24 * 60 * 60 * 1000;

export function createAuditIntakeCredential(now = new Date()) {
  const token = randomBytes(32).toString("base64url");

  return {
    token,
    tokenHash: auditIntakeTokenHash(token),
    expiresAt: new Date(now.getTime() + AUDIT_INTAKE_TTL_MS),
  };
}

export function auditIntakeTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function auditIntakeCookieValue(request: Request) {
  const item = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUDIT_INTAKE_COOKIE_NAME}=`));

  const value = item ? decodeURIComponent(item.slice(AUDIT_INTAKE_COOKIE_NAME.length + 1)) : null;

  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function requireSinglePublicOrganization(rows: Array<{ id: string }>) {
  if (rows.length === 0) {
    throw new Error("Public audit intake is not configured.");
  }

  if (rows.length !== 1) {
    throw new Error("Public audit intake must be enabled for exactly one organization.");
  }

  return rows[0].id;
}
