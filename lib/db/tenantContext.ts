import { AsyncLocalStorage } from "node:async_hooks";

export type SystemPurpose =
  | "provisioning"
  | "directory-sync"
  | "webhook-routing"
  | "job-recovery"
  | "bootstrap"
  | "migrations"
  | "diagnostics";

/** Purposes with no role reach every table, so nothing here may serve a browser request. */
export const PURPOSE_ROLES: Record<SystemPurpose, string | null> = {
  "provisioning": "scopeledger_provisioning",
  "directory-sync": "scopeledger_directory_sync",
  "webhook-routing": "scopeledger_webhook_routing",
  "job-recovery": "scopeledger_job_recovery",
  "bootstrap": "scopeledger_bootstrap",
  "migrations": null,
  "diagnostics": null
};

export type TenantContext = {
  organizationId: string | null;
  systemPurpose: SystemPurpose | null;
};

const storage = new AsyncLocalStorage<TenantContext>();

/**
 * Every statement runs with the tenant identity of whichever scope opened it,
 * applied as a transaction-scoped setting rather than a connection-scoped one.
 * A connection-scoped setting would survive being returned to the pool and
 * serve one organization's rows to the next request that borrowed it.
 */
export function withTenant<T>(organizationId: string, work: () => Promise<T>) {
  return storage.run({ organizationId, systemPurpose: null }, work);
}

/**
 * Reserved for work that legitimately precedes or spans tenant identity. The
 * purpose decides which tables the work can reach at all, so widening one is
 * widening the security boundary.
 */
export function withSystemAccess<T>(purpose: SystemPurpose, work: () => Promise<T>) {
  return storage.run({ organizationId: null, systemPurpose: purpose }, work);
}

export function currentTenantContext() {
  return storage.getStore() ?? null;
}
