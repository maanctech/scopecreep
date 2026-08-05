import type { OrganizationRole, Permission } from "@/lib/auth/types";

const reviewerPermissions: Permission[] = [
  "projects:read",
  "projects:write",
  "findings:read",
  "findings:review",
  "billing:read",
  "billing:write",
  "reports:read",
  "reports:write",
  "exports:read",
  "communications:write",
  "integrations:read",
  "settings:read"
];

const readOnlyPermissions: Permission[] = [
  "projects:read",
  "findings:read",
  "billing:read",
  "reports:read",
  "exports:read",
  "integrations:read",
  "members:read",
  "settings:read",
  "backups:read"
];

const adminPermissions: Permission[] = [
  ...reviewerPermissions,
  "leads:read",
  "leads:write",
  "integrations:write",
  "members:read",
  "members:write",
  "settings:write",
  "backups:read",
  "backups:write"
];

const permissionsByRole: Record<OrganizationRole, ReadonlySet<Permission>> = {
  Owner: new Set(adminPermissions),
  Admin: new Set(adminPermissions),
  Reviewer: new Set(reviewerPermissions),
  "Read Only": new Set(readOnlyPermissions)
};

export function hasPermission(role: OrganizationRole, permission: Permission) {
  return permissionsByRole[role].has(permission);
}

export function assertPermission(role: OrganizationRole, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new AuthorizationError(`The ${role} role cannot perform ${permission}.`);
  }
}

export class AuthorizationError extends Error {}
