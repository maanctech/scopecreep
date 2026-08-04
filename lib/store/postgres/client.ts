import { currentAuthContext } from "@/lib/auth/current";
import { query } from "@/lib/db/client";
import { requireSinglePublicOrganization } from "@/lib/publicIntake";

export type Context = { organizationId: string; userId: string; actor: string };
export type DbRow = Record<string, unknown>;

export function number(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

export function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();

  return String(value);
}

export function dollars(cents: unknown) {
  return Number(cents || 0) / 100;
}

export function cents(value: number | null | undefined) {
  return value == null ? null : Math.round(value * 100);
}

export async function requireContext(): Promise<Context> {
  const auth = await currentAuthContext();

  if (!auth) throw new Error("A valid organization session is required.");

  return {
    organizationId: auth.organizationId,
    userId: auth.userId,
    actor: auth.displayName
  };
}

export async function publicOrganizationId() {
  const result = await query<{ id: string }>(
    `SELECT o.id FROM organizations o
     JOIN organization_settings s ON s.organization_id = o.id
     WHERE COALESCE((s.settings->>'publicLeadCapture')::boolean, false) = true
     ORDER BY o.created_at LIMIT 2`
  );

  return requireSinglePublicOrganization(result.rows);
}
