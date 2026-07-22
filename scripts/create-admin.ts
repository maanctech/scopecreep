import { closePool } from "../lib/db/client";
import { runMigrations } from "../lib/db/migrations";
import { createInitialOwner } from "../lib/auth/service";

async function main() {
  const organizationName = process.env.SCOPELEDGER_ORGANIZATION_NAME?.trim();
  const displayName = process.env.SCOPELEDGER_ADMIN_NAME?.trim();
  const email = process.env.SCOPELEDGER_ADMIN_EMAIL?.trim();
  const password = process.env.SCOPELEDGER_ADMIN_PASSWORD;
  if (!organizationName || !displayName || !email || !password) {
    throw new Error(
      "Set SCOPELEDGER_ORGANIZATION_NAME, SCOPELEDGER_ADMIN_NAME, SCOPELEDGER_ADMIN_EMAIL, and SCOPELEDGER_ADMIN_PASSWORD."
    );
  }
  await runMigrations();
  const created = await createInitialOwner({ organizationName, displayName, email, password });
  console.log(`Created the initial owner for organization ${created.organizationId}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
