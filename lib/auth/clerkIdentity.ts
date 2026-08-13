import type { OrganizationRole } from "@/lib/auth/types";

export type ClerkSession = {
  clerkUserId: string;
  sessionId: string;
  clerkOrganizationId: string | null;
  clerkOrganizationRole: string | null;
  email: string | null;
  expiresAt: string;
};

type Claims = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Version 2 tokens nest the organization under `o` and carry the role without
 * its `org:` prefix; version 1 tokens use flat `org_id` and `org_role` claims
 * with the prefix. Both shapes are in circulation, so both are read here and
 * normalised to the unprefixed role.
 */
export function sessionFromClaims(claims: Claims): ClerkSession | null {
  const clerkUserId = text(claims.sub);

  if (!clerkUserId) return null;

  const organization = claims.o as Claims | undefined;
  const clerkOrganizationId = text(organization?.id) ?? text(claims.org_id);
  const role = text(organization?.rol) ?? text(claims.org_role);
  const expiresAt = typeof claims.exp === "number"
    ? new Date(claims.exp * 1000).toISOString()
    : new Date(0).toISOString();

  return {
    clerkUserId,
    sessionId: text(claims.sid) ?? clerkUserId,
    clerkOrganizationId,
    clerkOrganizationRole: role ? role.replace(/^org:/, "") : null,
    email: text(claims.email),
    expiresAt
  };
}

/**
 * Anything unmapped becomes Read Only. A role this app has never heard of must
 * not be able to change a billing decision because its name happened to sort
 * near one that can.
 */
export function organizationRoleFor(clerkRole: string | null): OrganizationRole {
  switch (clerkRole?.replace(/^org:/, "")) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "member":
      return "Reviewer";
    default:
      return "Read Only";
  }
}
