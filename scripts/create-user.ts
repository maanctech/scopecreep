import { ORGANIZATION_ROLES, type OrganizationRole } from "../lib/auth/types";
import { createOrganizationUser } from "../lib/auth/service";
import { closePool } from "../lib/db/client";

async function main() {
  const organizationId = process.env.SCOPELEDGER_ORGANIZATION_ID?.trim();
  const displayName = process.env.SCOPELEDGER_USER_NAME?.trim();
  const email = process.env.SCOPELEDGER_USER_EMAIL?.trim();
  const password = process.env.SCOPELEDGER_USER_PASSWORD;
  const role = process.env.SCOPELEDGER_USER_ROLE as OrganizationRole | undefined;
  if (!organizationId || !displayName || !email || !password || !role || !ORGANIZATION_ROLES.includes(role)) {
    throw new Error(
      `Set SCOPELEDGER_ORGANIZATION_ID, SCOPELEDGER_USER_NAME, SCOPELEDGER_USER_EMAIL, SCOPELEDGER_USER_PASSWORD, and SCOPELEDGER_USER_ROLE (${ORGANIZATION_ROLES.join(", ")}).`
    );
  }
  const created = await createOrganizationUser({ organizationId, displayName, email, password, role });
  console.log(`Created or updated user ${created.userId} with role ${role}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
