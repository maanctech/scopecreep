import { closePool, query } from "../lib/db/client";
import { normalizeEmail } from "../lib/auth/security";
import { createPasswordResetToken } from "../lib/auth/service";

async function main() {
  const email = process.env.SCOPELEDGER_ADMIN_EMAIL?.trim();

  if (!email) throw new Error("Set SCOPELEDGER_ADMIN_EMAIL to the account that needs a reset.");

  const result = await query<{ id: string }>("SELECT id FROM users WHERE normalized_email = $1", [normalizeEmail(email)]);

  if (!result.rows[0]) throw new Error("No active user has that email address.");

  const reset = await createPasswordResetToken(result.rows[0].id);
  const baseUrl = process.env.APP_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000";

  console.log(`Reset link (expires ${reset.expiresAt.toISOString()}):`);
  console.log(`${baseUrl}/reset-password?token=${encodeURIComponent(reset.token)}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
