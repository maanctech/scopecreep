// Generated from constants/json by `npm run constants:generate`. Do not edit.

export const ORGANIZATION_ROLES = [
  "Owner",
  "Admin",
  "Reviewer",
  "Read Only"
] as const;

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
  "settings:write"
] as const;

export const SESSION_COOKIE_NAME = "scopeledger_session";

export const SESSION_DURATION_MS = 43200000;

export const SESSION_IDLE_TIMEOUT = "4 hours";

export const MIN_PASSWORD_LENGTH = 12;
