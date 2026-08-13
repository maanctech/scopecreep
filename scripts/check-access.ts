import { clerkClient } from "@clerk/nextjs/server";
import { closePool, query } from "../lib/db/client";
import { withSystemAccess } from "../lib/db/tenantContext";

type MembershipRow = {
  organization_name: string;
  clerk_organization_id: string | null;
  email: string;
  clerk_user_id: string | null;
  is_system_admin: boolean;
  role: string;
};

async function localMemberships() {
  const found = await withSystemAccess(() =>
    query<MembershipRow>(
      `SELECT organizations.name AS organization_name,
              organizations.clerk_organization_id,
              users.email,
              users.clerk_user_id,
              users.is_system_admin,
              organization_memberships.role
       FROM organization_memberships
       JOIN organizations ON organizations.id = organization_memberships.organization_id
       JOIN users ON users.id = organization_memberships.user_id
       ORDER BY organizations.name, users.email`
    )
  );

  return found.rows;
}

function reportMemberships(memberships: MembershipRow[]) {
  console.log(`${memberships.length} membership(s) in the database:`);

  for (const row of memberships) {
    console.log("");
    console.log(`  ${row.email} -> ${row.organization_name} (${row.role})`);
    console.log(`    system administrator: ${row.is_system_admin ? "YES" : "no"}`);

    if (!row.clerk_user_id || !row.clerk_organization_id) {
      console.log("    NOT LINKED TO CLERK: this row predates the move and cannot sign in.");
    }
  }

  const administrators = memberships.filter((row) => row.is_system_admin);

  if (administrators.length) {
    console.log("");
    console.log(`${administrators.length} account(s) can read past every tenant policy. Confirm each is intended.`);
  }
}

/**
 * A local row is only ever written by a signed-in request that carries an
 * organization, so an empty table says nothing about whether the sign-in
 * worked. Asking Clerk separates the three ways it ends up empty: nobody
 * signed in, somebody signed in but belongs to no organization, or somebody
 * signed in with an organization and never opened a page that needed one.
 */
async function reportClerkDirectory() {
  const clerk = await clerkClient();
  const users = await clerk.users.getUserList({ limit: 20 });
  const organizations = await clerk.organizations.getOrganizationList({ limit: 20 });

  console.log(`Clerk holds ${users.totalCount} user(s) and ${organizations.totalCount} organization(s).`);

  for (const user of users.data) {
    const address = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId);
    const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.id });
    const belongs = memberships.data.map((membership) => `${membership.organization.name} as ${membership.role}`);

    console.log("");
    console.log(`  ${address?.emailAddress ?? user.id}`);
    console.log(`    ${belongs.length ? belongs.join(", ") : "belongs to no organization, so no request of theirs carries one"}`);
  }
}

async function main() {
  const memberships = await localMemberships();

  if (memberships.length) {
    reportMemberships(memberships);

    return;
  }

  console.log("Nobody has access. No signed-in request carrying an organization has ever reached this database.");
  console.log("");

  await reportClerkDirectory();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
