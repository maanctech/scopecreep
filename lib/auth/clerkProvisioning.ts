import { randomUUID } from "node:crypto";
import { liveClerkDirectory, type ClerkDirectory } from "@/lib/auth/clerkDirectory";
import { organizationRoleFor, type ClerkSession } from "@/lib/auth/clerkIdentity";
import type { AuthContext, OrganizationRole } from "@/lib/auth/types";
import { query } from "@/lib/db/client";
import { withSystemAccess } from "@/lib/db/tenantContext";

type OrganizationRow = { id: string; name: string };
type UserRow = { id: string; email: string; display_name: string; is_system_admin: boolean };

const UNIQUE_VIOLATION = "23505";

function slugFrom(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

  return slug || "firm";
}

function displayNameFrom(fullName: string | null, email: string) {
  const trimmed = fullName?.trim();

  if (trimmed && trimmed.length >= 2) return trimmed.slice(0, 120);

  const local = email.split("@")[0];

  return local.length >= 2 ? local.slice(0, 120) : `Member ${local}`;
}

function isSlugCollision(error: unknown) {
  return (error as { code?: string })?.code === UNIQUE_VIOLATION;
}

async function insertOrganization(clerkOrganizationId: string, name: string, slug: string) {
  const inserted = await query<OrganizationRow>(
    `INSERT INTO organizations (id, name, slug, clerk_organization_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name`,
    [randomUUID(), name, slug, clerkOrganizationId]
  );

  return inserted.rows[0];
}

async function organizationFor(clerkOrganizationId: string, directory: ClerkDirectory) {
  const existing = await query<OrganizationRow>(
    "SELECT id, name FROM organizations WHERE clerk_organization_id = $1",
    [clerkOrganizationId]
  );

  if (existing.rows[0]) return existing.rows[0];

  const remote = await directory.organization(clerkOrganizationId);
  const preferred = slugFrom(remote.slug ?? remote.name);

  try {
    return await insertOrganization(clerkOrganizationId, remote.name, preferred);
  } catch (error) {
    if (!isSlugCollision(error)) throw error;

    return insertOrganization(clerkOrganizationId, remote.name, `${preferred}-${randomUUID().slice(0, 8)}`);
  }
}

/**
 * Adopting an existing account because the address matches would let anyone
 * who can create a Clerk identity at that address inherit the firm's data, so
 * the sign-in fails instead and an operator decides what the link should be.
 */
export class EmailAlreadyClaimedError extends Error {
  constructor(email: string) {
    super(`${email} already belongs to an account that is not linked to this Clerk user`);
    this.name = "EmailAlreadyClaimedError";
  }
}

async function userFor(session: ClerkSession, directory: ClerkDirectory) {
  const existing = await query<UserRow>(
    "SELECT id, email, display_name, is_system_admin FROM users WHERE clerk_user_id = $1",
    [session.clerkUserId]
  );

  if (existing.rows[0]) return existing.rows[0];

  const remote = await directory.user(session.clerkUserId);
  const email = session.email ?? remote.email ?? `${session.clerkUserId}@clerk.invalid`;
  const claimed = await query("SELECT 1 FROM users WHERE normalized_email = $1", [email.toLowerCase()]);

  if (claimed.rows.length > 0) throw new EmailAlreadyClaimedError(email);

  const inserted = await query<UserRow>(
    `INSERT INTO users (id, email, normalized_email, display_name, clerk_user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, display_name, is_system_admin`,
    [randomUUID(), email, email.toLowerCase(), displayNameFrom(remote.fullName, email), session.clerkUserId]
  );

  return inserted.rows[0];
}

async function recordMembership(organizationId: string, userId: string, role: OrganizationRole) {
  await query(
    `INSERT INTO organization_memberships (organization_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now()`,
    [organizationId, userId, role]
  );
}

type KnownTenant = {
  organization_id: string;
  organization_name: string;
  user_id: string;
  email: string;
  display_name: string;
  is_system_admin: boolean;
  role: string | null;
};

async function knownTenant(session: ClerkSession) {
  const found = await query<KnownTenant>(
    `SELECT organizations.id AS organization_id,
            organizations.name AS organization_name,
            users.id AS user_id,
            users.email,
            users.display_name,
            users.is_system_admin,
            organization_memberships.role
     FROM organizations
     JOIN users ON users.clerk_user_id = $2
     LEFT JOIN organization_memberships
            ON organization_memberships.organization_id = organizations.id
           AND organization_memberships.user_id = users.id
     WHERE organizations.clerk_organization_id = $1`,
    [session.clerkOrganizationId, session.clerkUserId]
  );

  return found.rows[0] ?? null;
}

/**
 * Clerk is the record of who someone is; these tables are the record of what
 * their firm owns. Rows are written the first time a session presents an
 * unseen Clerk identifier rather than waiting for the matching webhook,
 * because the webhook and the user's first request race and the user usually
 * wins. Row-level security still keys on the local organization id, so a Clerk
 * identifier never reaches a policy.
 *
 * Every page a signed-in person opens comes through here, so the settled case
 * is one query and no write at all. Creating and correcting rows costs more,
 * and happens on a first sign-in or a role change rather than on every request.
 */
export async function authContextForSession(
  session: ClerkSession,
  directory: ClerkDirectory = liveClerkDirectory
): Promise<AuthContext | null> {
  if (!session.clerkOrganizationId) return null;

  const role = organizationRoleFor(session.clerkOrganizationRole);

  return withSystemAccess(async () => {
    const known = await knownTenant(session);

    if (known && known.role === role) {
      return {
        sessionId: session.sessionId,
        userId: known.user_id,
        organizationId: known.organization_id,
        organizationName: known.organization_name,
        email: known.email,
        displayName: known.display_name,
        role,
        isSystemAdmin: known.is_system_admin,
        expiresAt: session.expiresAt
      };
    }

    const organization = await organizationFor(session.clerkOrganizationId!, directory);
    const user = await userFor(session, directory);

    await recordMembership(organization.id, user.id, role);

    return {
      sessionId: session.sessionId,
      userId: user.id,
      organizationId: organization.id,
      organizationName: organization.name,
      email: user.email,
      displayName: user.display_name,
      role,
      isSystemAdmin: user.is_system_admin,
      expiresAt: session.expiresAt
    };
  });
}
