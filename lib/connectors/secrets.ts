import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/db/client";
import { decryptSecret, encryptSecret } from "@/lib/security/secrets";

function secretContext(
  organizationId: string,
  connectionId: string,
  name: string,
) {
  return `${organizationId}:${connectionId}:${name}`;
}

export async function saveConnectionSecret(
  client: PoolClient,
  organizationId: string,
  connectionId: string,
  name: string,
  value: string,
) {
  const encrypted = encryptSecret(
    value,
    secretContext(organizationId, connectionId, name),
  );
  await client.query(
    `INSERT INTO encrypted_secrets (id,organization_id,connection_id,name,ciphertext,initialization_vector,auth_tag)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (organization_id,connection_id,name) DO UPDATE SET ciphertext=EXCLUDED.ciphertext,initialization_vector=EXCLUDED.initialization_vector,auth_tag=EXCLUDED.auth_tag,key_version=encrypted_secrets.key_version+1,updated_at=now()`,
    [
      randomUUID(),
      organizationId,
      connectionId,
      name,
      encrypted.ciphertext,
      encrypted.initializationVector,
      encrypted.authTag,
    ],
  );
}

export async function connectionSecrets(
  organizationId: string,
  connectionId: string,
  client?: PoolClient,
) {
  const statement =
    "SELECT name,ciphertext,initialization_vector,auth_tag FROM encrypted_secrets WHERE organization_id=$1 AND connection_id=$2";
  const values = [organizationId, connectionId];
  const result = client
    ? await client.query<{
        name: string;
        ciphertext: string;
        initialization_vector: string;
        auth_tag: string;
      }>(statement, values)
    : await query<{
        name: string;
        ciphertext: string;
        initialization_vector: string;
        auth_tag: string;
      }>(statement, values);
  return Object.fromEntries(
    result.rows.map((row) => [
      row.name,
      decryptSecret(
        {
          ciphertext: row.ciphertext,
          initializationVector: row.initialization_vector,
          authTag: row.auth_tag,
        },
        secretContext(organizationId, connectionId, row.name),
      ),
    ]),
  );
}
