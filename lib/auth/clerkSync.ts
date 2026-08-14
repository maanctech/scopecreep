import { organizationRoleFor } from "@/lib/auth/clerkIdentity";
import { query } from "@/lib/db/client";
import { withSystemAccess } from "@/lib/db/tenantContext";

export type ClerkEvent = {
  type: string;
  data: Record<string, unknown>;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function nested(value: unknown, key: string) {
  return (value as Record<string, unknown> | undefined)?.[key];
}

function primaryEmail(data: Record<string, unknown>) {
  const addresses = (data.email_addresses as { id?: string; email_address?: string }[] | undefined) ?? [];
  const primary = addresses.find((address) => address.id === data.primary_email_address_id);

  return text(primary?.email_address) ?? text(addresses[0]?.email_address);
}

async function renameOrganization(data: Record<string, unknown>) {
  const clerkOrganizationId = text(data.id);
  const name = text(data.name);

  if (!clerkOrganizationId || !name) return;

  await query("UPDATE organizations SET name = $1, updated_at = now() WHERE clerk_organization_id = $2", [
    name,
    clerkOrganizationId
  ]);
}

async function updatePerson(data: Record<string, unknown>) {
  const clerkUserId = text(data.id);
  const email = primaryEmail(data);
  const displayName = [text(data.first_name), text(data.last_name)].filter(Boolean).join(" ");

  if (!clerkUserId || !email || displayName.length < 2) return;

  await query(
    `UPDATE users SET email = $1, normalized_email = $2, display_name = $3, updated_at = now()
     WHERE clerk_user_id = $4`,
    [email, email.toLowerCase(), displayName.slice(0, 120), clerkUserId]
  );
}

async function localIdentifiers(data: Record<string, unknown>) {
  const clerkOrganizationId = text(nested(data.organization, "id"));
  const clerkUserId = text(nested(data.public_user_data, "user_id"));

  if (!clerkOrganizationId || !clerkUserId) return null;

  const found = await query<{ organization_id: string; user_id: string }>(
    `SELECT organizations.id AS organization_id, users.id AS user_id
     FROM organizations, users
     WHERE organizations.clerk_organization_id = $1 AND users.clerk_user_id = $2`,
    [clerkOrganizationId, clerkUserId]
  );

  return found.rows[0] ?? null;
}

async function writeMembership(data: Record<string, unknown>) {
  const identifiers = await localIdentifiers(data);

  if (!identifiers) return;

  const role = organizationRoleFor(text(data.role));

  await query(
    `INSERT INTO organization_memberships (organization_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now()`,
    [identifiers.organization_id, identifiers.user_id, role]
  );
}

async function removeMembership(data: Record<string, unknown>) {
  const identifiers = await localIdentifiers(data);

  if (!identifiers) return;

  await query("DELETE FROM organization_memberships WHERE organization_id = $1 AND user_id = $2", [
    identifiers.organization_id,
    identifiers.user_id
  ]);
}

/**
 * Membership and naming follow Clerk; a firm's work does not. Nothing here
 * deletes an organization or a person's records, because a mistaken click in
 * Clerk's dashboard must not be able to destroy the audit history a firm bills
 * from. Removing access is reversible; removing the ledger is not.
 */
export async function applyClerkEvent(event: ClerkEvent) {
  return withSystemAccess("directory-sync", async () => {
    switch (event.type) {
      case "organization.created":
      case "organization.updated":
        return renameOrganization(event.data);
      case "user.updated":
        return updatePerson(event.data);
      case "organizationMembership.created":
      case "organizationMembership.updated":
        return writeMembership(event.data);
      case "organizationMembership.deleted":
        return removeMembership(event.data);
      default:
        return undefined;
    }
  });
}
