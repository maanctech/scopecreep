import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

export async function findOrCreateCompany(client: PoolClient, organizationId: string, name: string, details?: { website?: string | null; businessType?: string | null; teamSize?: string | null }) {
  const existing = await client.query<{ id: string }>(
    "SELECT id FROM companies WHERE organization_id = $1 AND lower(name) = lower($2) LIMIT 1",
    [organizationId, name.trim()]
  );

  if (existing.rows[0]) return existing.rows[0].id;

  const id = randomUUID();

  await client.query(
    `INSERT INTO companies (id, organization_id, name, website, business_type, team_size)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, organizationId, name.trim(), details?.website ?? null, details?.businessType ?? null, details?.teamSize ?? null]
  );

  return id;
}
