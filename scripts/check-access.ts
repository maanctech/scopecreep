import { clerkClient, verifyToken } from "@clerk/nextjs/server";
import { closePool, query } from "../lib/db/client";
import { withSystemAccess } from "../lib/db/tenantContext";

type ClerkBackend = Awaited<ReturnType<typeof clerkClient>>;

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

/** A token minted here carries no azp, so the origin check is left out rather than always failing. */
async function reportTokenVerification(clerk: ClerkBackend, sessionId: string) {
  const minted = await clerk.sessions.getToken(sessionId);

  try {
    const claims = await verifyToken(minted.jwt, { secretKey: process.env.CLERK_SECRET_KEY?.trim() });
    const organization = claims.o as { id?: string; rol?: string } | undefined;

    console.log(`      its token is valid and would sign in as ${organization?.rol ?? "no role"} of ${organization?.id ?? "no organization"}`);
    console.log(`      so only the browser's origin is left: it must be exactly ${process.env.APP_URL?.trim()}`);
  } catch (error) {
    console.log(`      its token FAILS this application's verification: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** An empty table cannot say which of the three ways it got that way, so ask Clerk. */
async function reportClerkDirectory() {
  const clerk = await clerkClient();
  const users = await clerk.users.getUserList({ limit: 20 });
  const organizations = await clerk.organizations.getOrganizationList({ limit: 20 });

  console.log(`Clerk holds ${users.totalCount} user(s) and ${organizations.totalCount} organization(s).`);
  console.log(`A session is only accepted from ${process.env.APP_URL?.trim() || "nowhere: APP_URL is unset"}. Signing in at any other host verifies as nobody.`);

  for (const user of users.data) {
    const address = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId);
    const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.id });
    const belongs = memberships.data.map((membership) => `${membership.organization.name} as ${membership.role}`);
    const sessions = await clerk.sessions.getSessionList({ userId: user.id, limit: 10 });

    console.log("");
    console.log(`  ${address?.emailAddress ?? user.id}`);
    console.log(`    ${belongs.length ? belongs.join(", ") : "belongs to no organization, so no request of theirs carries one"}`);

    if (!sessions.data.length) {
      console.log("    has never opened a browser session, so nothing was ever presented to this application");
    }

    for (const session of sessions.data) {
      const active = session.lastActiveOrganizationId;

      console.log(`    session ${session.status}, last active ${new Date(session.lastActiveAt).toISOString()}`);
      console.log(`      active organization: ${active ?? "none, so its token carries no organization and this application sees nobody"}`);

      await reportTokenVerification(clerk, session.id);
    }
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
