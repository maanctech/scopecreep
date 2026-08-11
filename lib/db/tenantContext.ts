import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContext = {
  organizationId: string | null;
  systemAccess: boolean;
};

const storage = new AsyncLocalStorage<TenantContext>();

/**
 * Every statement runs with the tenant identity of whichever scope opened it,
 * applied as a transaction-scoped setting rather than a connection-scoped one.
 * A connection-scoped setting would survive being returned to the pool and
 * serve one organization's rows to the next request that borrowed it.
 */
export function withTenant<T>(organizationId: string, work: () => Promise<T>) {
  return storage.run({ organizationId, systemAccess: false }, work);
}

/**
 * Reserved for work that legitimately precedes or spans tenant identity:
 * resolving a session token to its organization, first-run setup, migrations,
 * and whole-installation backups. Policies admit it explicitly, so widening
 * this is widening the security boundary.
 */
export function withSystemAccess<T>(work: () => Promise<T>) {
  return storage.run({ organizationId: null, systemAccess: true }, work);
}

export function currentTenantContext() {
  return storage.getStore() ?? null;
}
