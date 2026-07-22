import { promises as fs } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildDemoStore, DEMO_PROJECT_ID } from "@/lib/demoData";
import { computeRevenueTotals } from "@/lib/domain/revenueTotals";
import {
  LocalStoreFormatError,
  migrateStoreShape
} from "@/lib/migrations/localStore";
import { getFindings, LocalStoreCorruptError, resetLocalDemoStore } from "@/lib/store";
import type { ScopeFinding } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "demo-store.json");

/**
 * Rebuilds the original v1 file shape from the current demo data: no
 * schema_version, AI-only `scopeAnalyses`, no billing events, no is_demo
 * markers.
 */
function buildLegacyV1Store() {
  const v2 = buildDemoStore();
  const scopeAnalyses = v2.scopeFindings.map((finding: ScopeFinding) => ({
    id: finding.id,
    client_message_id: finding.client_message_id,
    classification: finding.classification,
    confidence_score: finding.confidence_score,
    reasoning: finding.reasoning,
    relevant_sow_sections: finding.relevant_sow_sections,
    request_type: finding.request_type,
    estimated_hours: finding.estimated_hours,
    estimated_revenue: finding.estimated_revenue,
    suggested_change_order: finding.suggested_change_order,
    internal_note: finding.internal_note,
    created_at: finding.created_at
  }));

  return {
    users: v2.users,
    companies: v2.companies,
    leads: v2.leads,
    leadStatusHistory: v2.leadStatusHistory,
    auditRequests: v2.auditRequests,
    projects: v2.projects.map((project) => {
      const legacy: Record<string, unknown> = { ...project };
      delete legacy.is_demo;
      return legacy;
    }),
    clientMessages: v2.clientMessages,
    scopeAnalyses,
    reports: [],
    salesTemplates: v2.salesTemplates
  };
}

async function listBackupFiles() {
  const entries = await fs.readdir(dataDir);
  return entries.filter(
    (name) => name.includes("pre-migration-backup") || name.includes("corrupt")
  );
}

async function cleanBackups() {
  for (const name of await listBackupFiles()) {
    await fs.rm(path.join(dataDir, name));
  }
}

afterAll(async () => {
  await cleanBackups();
  await resetLocalDemoStore();
});

describe("migrateStoreShape (pure)", () => {
  it("migrates v1 scopeAnalyses into Scope Findings without losing anything", () => {
    const legacy = buildLegacyV1Store();
    const { store, migrated } = migrateStoreShape(legacy);

    expect(migrated).toBe(true);
    expect(store.schema_version).toBe(2);
    expect(store.scopeFindings).toHaveLength(12);
    expect(store.clientMessages).toHaveLength(12);
    expect(store.leads).toHaveLength(legacy.leads.length);
    expect(store.projects).toHaveLength(legacy.projects.length);
    expect(store.auditRequests).toHaveLength(legacy.auditRequests.length);

    for (const finding of store.scopeFindings) {
      expect(finding.project_id).toBe(DEMO_PROJECT_ID);
      expect(finding.billing_decision).toBe("Undecided");
      expect(finding.workflow_status).toBe(
        finding.classification === "In Scope" ? "New" : "Needs Review"
      );
      expect(finding.approved_amount_cents).toBeNull();
      expect(finding.version).toBe(1);
      expect(finding.client_facing_explanation).toBe(finding.suggested_change_order);
      expect(finding.is_demo).toBe(true);
    }
  });

  it("preserves the Northstar $13,475 potential total through migration", () => {
    const { store } = migrateStoreShape(buildLegacyV1Store());
    expect(computeRevenueTotals(store.scopeFindings).potential_dollars).toBe(13475);
  });

  it("creates one append-only Finding Created event per migrated finding", () => {
    const { store } = migrateStoreShape(buildLegacyV1Store());
    expect(store.billingEvents).toHaveLength(12);
    for (const event of store.billingEvents) {
      expect(event.event_type).toBe("Finding Created");
      expect(event.actor).toBe("System Migration");
    }
  });

  it("is deterministic and repeatable", () => {
    const first = migrateStoreShape(buildLegacyV1Store());
    const second = migrateStoreShape(buildLegacyV1Store());
    expect(first.store).toEqual(second.store);
  });

  it("marks non-demo projects and their findings as real records", () => {
    const legacy = buildLegacyV1Store();
    legacy.projects.push({
      id: "real-project-1",
      company_id: null,
      lead_id: null,
      audit_request_id: null,
      client_name: "Real Client",
      project_name: "Real Project",
      hourly_rate: 100,
      project_value: null,
      sow_text: "Real SOW.",
      created_at: "2026-07-01T00:00:00.000Z"
    });
    legacy.clientMessages = [
      ...legacy.clientMessages,
      {
        id: "real-message-1",
        project_id: "real-project-1",
        source: "Email" as const,
        sender: null,
        message_text: "Can you add a new dashboard?",
        message_date: null,
        created_at: "2026-07-01T00:00:00.000Z"
      }
    ];
    legacy.scopeAnalyses.push({
      ...legacy.scopeAnalyses[3],
      id: "real-analysis-1",
      client_message_id: "real-message-1"
    });

    const { store } = migrateStoreShape(legacy);
    const realFinding = store.scopeFindings.find((finding) => finding.id === "real-analysis-1");
    expect(realFinding?.is_demo).toBe(false);
    expect(realFinding?.project_id).toBe("real-project-1");
    const demoFinding = store.scopeFindings.find((finding) => finding.id !== "real-analysis-1");
    expect(demoFinding?.is_demo).toBe(true);
  });

  it("passes v2 stores through unchanged", () => {
    const { store, migrated } = migrateStoreShape(buildDemoStore());
    expect(migrated).toBe(false);
    expect(store.scopeFindings).toHaveLength(12);
  });

  it("rejects unusable store shapes instead of substituting demo data", () => {
    expect(() => migrateStoreShape([])).toThrow(LocalStoreFormatError);
    expect(() => migrateStoreShape("nope")).toThrow(LocalStoreFormatError);
    expect(() => migrateStoreShape({ schema_version: 99 })).toThrow(LocalStoreFormatError);
  });
});

describe("store file migration (filesystem)", () => {
  it("migrates a legacy file on first read and backs up the original", async () => {
    await cleanBackups();
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dataFile, JSON.stringify(buildLegacyV1Store(), null, 2));

    const findings = await getFindings();
    expect(findings).toHaveLength(12);
    expect(findings.every((row) => row.finding.billing_decision === "Undecided")).toBe(true);

    const backups = await listBackupFiles();
    expect(backups.some((name) => name.includes("pre-migration-backup"))).toBe(true);

    const persisted = JSON.parse(await fs.readFile(dataFile, "utf8"));
    expect(persisted.schema_version).toBe(2);
    expect(persisted.scopeFindings).toHaveLength(12);
  });

  it("backs up corrupt files and fails loudly instead of silently reseeding", async () => {
    await cleanBackups();
    await fs.writeFile(dataFile, "{this is not json");

    await expect(getFindings()).rejects.toThrow(LocalStoreCorruptError);

    const backups = await listBackupFiles();
    expect(backups.some((name) => name.includes("corrupt"))).toBe(true);

    // The corrupt original still exists in the backup; nothing demo-related
    // was silently written over the user's data file location either.
    const stillCorrupt = await fs.readFile(dataFile, "utf8");
    expect(stillCorrupt).toBe("{this is not json");
  });
});
