import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JSON_DIRECTORY } from "@/scripts/generate-constants";

const MIGRATIONS_DIRECTORY = path.join(JSON_DIRECTORY, "..", "..", "db", "migrations");

type ColumnTarget = {
  table: string;
  column: string;
};

const SQL_BACKED_ENUMERATIONS: Array<{ source: string; key: string; targets: ColumnTarget[] }> = [
  { source: "domain", key: "classifications", targets: [{ table: "scope_findings", column: "classification" }] },
  { source: "domain", key: "requestTypes", targets: [{ table: "scope_findings", column: "request_type" }] },
  { source: "domain", key: "leadStatuses", targets: [{ table: "leads", column: "status" }] },
  { source: "domain", key: "auditRequestStatuses", targets: [{ table: "audit_requests", column: "status" }] },
  { source: "domain", key: "billingDecisions", targets: [{ table: "scope_findings", column: "billing_decision" }] },
  { source: "domain", key: "workflowStatuses", targets: [{ table: "scope_findings", column: "workflow_status" }] },
  { source: "domain", key: "reportTypes", targets: [{ table: "report_versions", column: "report_type" }] },
  { source: "auth", key: "organizationRoles", targets: [{ table: "organization_memberships", column: "role" }] },
  { source: "sow", key: "boundaryTypes", targets: [{ table: "scope_boundary_items", column: "boundary_type" }] },
  { source: "sow", key: "documentStatuses", targets: [{ table: "sow_documents", column: "status" }] },
  { source: "sow", key: "versionSourceTypes", targets: [{ table: "sow_versions", column: "source_type" }] },
  { source: "sow", key: "extractionStatuses", targets: [{ table: "sow_versions", column: "extraction_status" }] },
  { source: "sow", key: "boundaryMapStatuses", targets: [{ table: "scope_boundary_maps", column: "status" }] },
  { source: "sow", key: "riskReviewStatuses", targets: [{ table: "sow_risk_reviews", column: "status" }] },
  { source: "sow", key: "riskSeverities", targets: [{ table: "sow_risk_items", column: "severity" }] },
  { source: "ingestion", key: "connectorProviders", targets: [{ table: "communication_connections", column: "provider" }] },
  { source: "ingestion", key: "connectorStatuses", targets: [{ table: "communication_connections", column: "status" }] },
  { source: "ingestion", key: "oauthProviders", targets: [{ table: "oauth_authorization_requests", column: "provider" }] },
  {
    source: "analysis",
    key: "jobStatuses",
    targets: [{ table: "analysis_jobs", column: "status" }, { table: "ingestion_jobs", column: "status" }]
  },
  { source: "operations", key: "backupStatuses", targets: [{ table: "backup_records", column: "status" }] }
];

function readJsonEnumeration(source: string, key: string) {
  const parsed = JSON.parse(readFileSync(path.join(JSON_DIRECTORY, `${source}.json`), "utf8")) as Record<string, unknown>;

  return parsed[key] as string[];
}

/**
 * Later migrations replace earlier CHECK constraints, so the effective set is
 * whichever definition appears last when the files are applied in order. Only
 * CREATE TABLE and ALTER TABLE statements are read, which keeps an `IN` list in
 * a data-backfilling UPDATE from being mistaken for a constraint.
 */
function effectiveCheckConstraints() {
  const constraints = new Map<string, string[]>();
  const files = readdirSync(MIGRATIONS_DIRECTORY).filter((entry) => entry.endsWith(".sql")).sort();

  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIRECTORY, file), "utf8").replace(/\$\$[\s\S]*?\$\$/g, "");

    for (const statement of sql.split(";")) {
      const target = statement.match(/\b(?:CREATE\s+TABLE|ALTER\s+TABLE)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)/i);

      if (!target) continue;

      const lists = statement.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s+IN\s*\(\s*((?:'[^']*'\s*,\s*)*'[^']*')\s*\)/gi);

      for (const [, column, values] of lists) {
        const parsed = [...values.matchAll(/'([^']*)'/g)].map(([, value]) => value);

        constraints.set(`${target[1]}.${column}`, parsed);
      }
    }
  }

  return constraints;
}

describe("SQL CHECK constraints agree with the JSON constants", () => {
  const constraints = effectiveCheckConstraints();

  it("finds the CHECK constraints it is meant to compare against", () => {
    const missing = SQL_BACKED_ENUMERATIONS
      .flatMap(({ targets }) => targets)
      .filter(({ table, column }) => !constraints.has(`${table}.${column}`))
      .map(({ table, column }) => `${table}.${column}`);

    expect(missing).toEqual([]);
  });

  it.each(SQL_BACKED_ENUMERATIONS.flatMap(({ source, key, targets }) => targets.map((target) => ({ source, key, ...target }))))(
    "$table.$column permits exactly the values in $source.json $key",
    ({ source, key, table, column }) => {
      const declared = readJsonEnumeration(source, key);
      const enforced = constraints.get(`${table}.${column}`);

      expect([...(enforced ?? [])].sort()).toEqual([...declared].sort());
    }
  );

  it("reads the migration that widened sow_versions.source_type rather than the original definition", () => {
    expect(constraints.get("sow_versions.source_type")).toContain("DOCX");
  });

  it("reads the migration that replaced the communication_connections status vocabulary", () => {
    expect(constraints.get("communication_connections.status")).not.toContain("Not Connected");
  });
});
