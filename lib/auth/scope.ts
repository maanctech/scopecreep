import { currentAuthContext } from "@/lib/auth/current";
import type { AuthContext } from "@/lib/auth/types";
import { withTenant } from "@/lib/db/tenantContext";

/**
 * The only supported way for a service to reach the database on behalf of a
 * signed-in user. Resolving the session and opening the tenant scope have to
 * happen together: `AsyncLocalStorage.enterWith` does not travel back to a
 * caller that already awaited, so a helper that merely returned the session
 * would leave every following statement with no tenant and no rows.
 */
export async function withAuthenticatedTenant<T>(work: (auth: AuthContext) => Promise<T>): Promise<T> {
  const auth = await currentAuthContext();

  if (!auth) throw new Error("A valid organization session is required.");

  return withTenant(auth.organizationId, () => work(auth));
}
