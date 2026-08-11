import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { PoolClient } from "pg";
import { SESSION_DURATION_MS, SESSION_IDLE_TIMEOUT } from "@/constants/typescript/auth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { normalizeEmail, PublicError } from "@/lib/auth/security";
import type { AuthContext, OrganizationRole } from "@/lib/auth/types";
import { query, transaction } from "@/lib/db/client";

/**
 * Verified against when no user matches, so that a sign-in attempt for an
 * unknown address costs the same Argon2 work as one for a real account. Without
 * it the response time alone reveals which addresses are registered.
 */
const ABSENT_USER_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=3,p=1$JLm6Q7FbCwozRZZj7xzZ3w$LU543tIVKLOHUuBlB7kwxdSs/apvsQrtTECkxAyBIgc";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return slug || `workspace-${randomUUID().slice(0, 8)}`;
}

/**
 * `user_sessions.ip_address` and `audit_logs.ip_address` are both `inet`, and
 * the caller's value comes from an X-Forwarded-For header that is absent on a
 * direct connection and arbitrary when present. Anything that is not a literal
 * address has to become NULL or PostgreSQL rejects the whole statement.
 */
function inetOrNull(value: string | null | undefined) {
  return value && isIP(value) ? value : null;
}

async function writeAuditLog(
  client: PoolClient,
  input: {
    organizationId: string | null;
    actorUserId: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
  }
) {
  await client.query(
    `INSERT INTO audit_logs
      (id, organization_id, actor_user_id, action, resource_type, resource_id, metadata, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
    [
      randomUUID(),
      input.organizationId,
      input.actorUserId,
      input.action,
      input.resourceType,
      input.resourceId ?? null,
      JSON.stringify(input.metadata ?? {}),
      inetOrNull(input.ipAddress)
    ]
  );
}

export async function hasAnyUsers() {
  const result = await query<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM users) AS exists");

  return result.rows[0]?.exists ?? false;
}

export async function createInitialOwner(input: {
  organizationName: string;
  displayName: string;
  email: string;
  password: string;
}) {
  const passwordHash = await hashPassword(input.password);
  const normalizedEmail = normalizeEmail(input.email);

  return transaction(async (client) => {
    await client.query("LOCK TABLE users IN EXCLUSIVE MODE");
    const existing = await client.query("SELECT 1 FROM users LIMIT 1");

    if (existing.rowCount) throw new PublicError("Initial setup has already been completed.");

    const organizationId = randomUUID();
    const userId = randomUUID();
    const baseSlug = slugify(input.organizationName);

    await client.query(
      `INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)`,
      [organizationId, input.organizationName.trim(), baseSlug]
    );
    await client.query(
      `INSERT INTO users (id, email, normalized_email, password_hash, display_name, is_system_admin)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [userId, input.email.trim(), normalizedEmail, passwordHash, input.displayName.trim()]
    );
    await client.query(
      `INSERT INTO organization_memberships (organization_id, user_id, role)
       VALUES ($1, $2, 'Owner')`,
      [organizationId, userId]
    );
    await client.query(
      "INSERT INTO organization_settings (organization_id, settings) VALUES ($1, $2::jsonb)",
      [organizationId, JSON.stringify({ publicLeadCapture: true })]
    );
    await writeAuditLog(client, {
      organizationId,
      actorUserId: userId,
      action: "initial_setup_completed",
      resourceType: "organization",
      resourceId: organizationId
    });

    return { organizationId, userId };
  });
}

export async function createOrganizationUser(input: {
  organizationId: string;
  displayName: string;
  email: string;
  password: string;
  role: OrganizationRole;
}) {
  const passwordHash = await hashPassword(input.password);
  const normalizedEmail = normalizeEmail(input.email);

  return transaction(async (client) => {
    const organization = await client.query("SELECT 1 FROM organizations WHERE id = $1", [input.organizationId]);

    if (!organization.rowCount) throw new Error("Organization not found.");

    const existing = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE normalized_email = $1 FOR UPDATE",
      [normalizedEmail]
    );
    const userId = existing.rows[0]?.id ?? randomUUID();

    if (!existing.rows[0]) {
      await client.query(
        `INSERT INTO users (id, email, normalized_email, password_hash, display_name)
         VALUES ($1,$2,$3,$4,$5)`,
        [userId, input.email.trim(), normalizedEmail, passwordHash, input.displayName.trim()]
      );
    }

    await client.query(
      `INSERT INTO organization_memberships (organization_id, user_id, role)
       VALUES ($1,$2,$3)
       ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now()`,
      [input.organizationId, userId, input.role]
    );
    await writeAuditLog(client, {
      organizationId: input.organizationId,
      actorUserId: null,
      action: existing.rows[0] ? "membership_updated_by_server_admin" : "user_created_by_server_admin",
      resourceType: "user",
      resourceId: userId,
      metadata: { role: input.role }
    });

    return { userId };
  });
}

export async function authenticateUser(email: string, password: string) {
  const result = await query<{
    id: string;
    password_hash: string;
    disabled_at: string | null;
  }>("SELECT id, password_hash, disabled_at FROM users WHERE normalized_email = $1", [
    normalizeEmail(email)
  ]);
  const user = result.rows[0];
  const matches = await verifyPassword(
    user?.password_hash ?? ABSENT_USER_PASSWORD_HASH,
    password
  );

  if (!user || user.disabled_at || !matches) return null;

  return user.id;
}

export async function createSession(input: {
  userId: string;
  organizationId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const memberships = await query<{ organization_id: string; role: OrganizationRole }>(
    `SELECT organization_id, role
     FROM organization_memberships
     WHERE user_id = $1
     ORDER BY CASE role WHEN 'Owner' THEN 1 WHEN 'Admin' THEN 2 WHEN 'Reviewer' THEN 3 ELSE 4 END`,
    [input.userId]
  );
  const membership = input.organizationId
    ? memberships.rows.find((row) => row.organization_id === input.organizationId)
    : memberships.rows[0];

  if (!membership) throw new Error("User does not belong to this organization.");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const sessionId = randomUUID();

  await transaction(async (client) => {
    await client.query(
      `INSERT INTO user_sessions
        (id, user_id, organization_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sessionId,
        input.userId,
        membership.organization_id,
        hashToken(token),
        expiresAt,
        inetOrNull(input.ipAddress),
        input.userAgent?.slice(0, 500) ?? null
      ]
    );
    await writeAuditLog(client, {
      organizationId: membership.organization_id,
      actorUserId: input.userId,
      action: "user.signed_in",
      resourceType: "user_session",
      resourceId: sessionId,
      metadata: { role: membership.role },
      ipAddress: input.ipAddress
    });
  });

  return { token, expiresAt, organizationId: membership.organization_id };
}

export async function getAuthContext(token: string): Promise<AuthContext | null> {
  const result = await query<AuthContext & { expires_at: string }>(
    `WITH touched AS (
       UPDATE user_sessions s SET last_seen_at = now()
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
         AND s.last_seen_at > now() - $2::interval
       RETURNING s.id, s.user_id, s.organization_id, s.expires_at
     )
     SELECT
       t.id AS "sessionId", u.id AS "userId", o.id AS "organizationId",
       o.name AS "organizationName", u.email, u.display_name AS "displayName",
       m.role, u.is_system_admin AS "isSystemAdmin", t.expires_at AS "expiresAt"
     FROM touched t
     JOIN users u ON u.id = t.user_id
     JOIN organizations o ON o.id = t.organization_id
     JOIN organization_memberships m
       ON m.user_id = t.user_id AND m.organization_id = t.organization_id
     WHERE u.disabled_at IS NULL`,
    [hashToken(token), SESSION_IDLE_TIMEOUT]
  );

  return result.rows[0] ?? null;
}

export async function revokeSession(token: string) {
  await transaction(async (client) => {
    const revoked = await client.query<{
      id: string;
      user_id: string;
      organization_id: string;
    }>(
      `UPDATE user_sessions SET revoked_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL
       RETURNING id, user_id, organization_id`,
      [hashToken(token)]
    );
    const session = revoked.rows[0];

    if (!session) return;

    await writeAuditLog(client, {
      organizationId: session.organization_id,
      actorUserId: session.user_id,
      action: "user.signed_out",
      resourceType: "user_session",
      resourceId: session.id
    });
  });
}

export async function changePassword(input: {
  userId: string;
  organizationId: string;
  currentPassword: string;
  newPassword: string;
  keepSessionId: string;
}) {
  const passwordHash = await hashPassword(input.newPassword);

  return transaction(async (client) => {
    const result = await client.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1 AND disabled_at IS NULL FOR UPDATE",
      [input.userId]
    );

    if (!result.rows[0] || !(await verifyPassword(result.rows[0].password_hash, input.currentPassword))) {
      throw new PublicError("Current password is incorrect.");
    }

    await client.query(
      "UPDATE users SET password_hash = $1, password_changed_at = now(), updated_at = now() WHERE id = $2",
      [passwordHash, input.userId]
    );
    const revoked = await client.query(
      "UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL",
      [input.userId, input.keepSessionId]
    );

    await writeAuditLog(client, {
      organizationId: input.organizationId,
      actorUserId: input.userId,
      action: "user.password_changed",
      resourceType: "user",
      resourceId: input.userId,
      metadata: { revokedSessions: revoked.rowCount ?? 0 }
    });
  });
}

export async function createPasswordResetToken(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await transaction(async (client) => {
    await client.query(
      "UPDATE password_reset_tokens SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL",
      [userId]
    );
    await client.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, hashToken(token), expiresAt]
    );
  });

  return { token, expiresAt };
}

export async function resetPassword(token: string, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);

  return transaction(async (client) => {
    const result = await client.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
       FOR UPDATE`,
      [hashToken(token)]
    );
    const reset = result.rows[0];

    if (!reset) throw new PublicError("This password reset link is invalid or expired.");

    await client.query(
      "UPDATE users SET password_hash = $1, password_changed_at = now(), updated_at = now() WHERE id = $2",
      [passwordHash, reset.user_id]
    );
    await client.query("UPDATE password_reset_tokens SET consumed_at = now() WHERE id = $1", [reset.id]);

    const revoked = await client.query(
      "UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
      [reset.user_id]
    );
    const membership = await client.query<{ organization_id: string }>(
      "SELECT organization_id FROM organization_memberships WHERE user_id = $1 ORDER BY created_at LIMIT 1",
      [reset.user_id]
    );

    await writeAuditLog(client, {
      organizationId: membership.rows[0]?.organization_id ?? null,
      actorUserId: reset.user_id,
      action: "user.password_reset",
      resourceType: "user",
      resourceId: reset.user_id,
      metadata: { revokedSessions: revoked.rowCount ?? 0 }
    });

    return reset.user_id;
  });
}
