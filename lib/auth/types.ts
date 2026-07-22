export const ORGANIZATION_ROLES = ["Owner", "Admin", "Reviewer", "Read Only"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export type AuthContext = {
  sessionId: string;
  userId: string;
  organizationId: string;
  organizationName: string;
  email: string;
  displayName: string;
  role: OrganizationRole;
  isSystemAdmin: boolean;
  expiresAt: string;
};

export const PERMISSIONS = [
  "projects:read",
  "projects:write",
  "leads:read",
  "leads:write",
  "findings:read",
  "findings:review",
  "billing:read",
  "billing:write",
  "reports:read",
  "reports:write",
  "exports:read",
  "integrations:read",
  "integrations:write",
  "members:read",
  "members:write",
  "settings:read",
  "settings:write",
  "backups:read",
  "backups:write"
] as const;

export type Permission = (typeof PERMISSIONS)[number];
