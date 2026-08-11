import { ORGANIZATION_ROLES, PERMISSIONS } from "@/constants/typescript/auth";

export { ORGANIZATION_ROLES, PERMISSIONS };

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

export type Permission = (typeof PERMISSIONS)[number];
