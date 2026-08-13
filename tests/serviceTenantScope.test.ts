import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { query } from "@/lib/db/client";
import { withSystemAccess, withTenant } from "@/lib/db/tenantContext";
import type { AuthContext } from "@/lib/auth/types";
import { startTestDatabase, stopTestDatabase, type TestDatabase } from "./support/testDatabase";

/**
 * Resolving a session is the one thing that cannot run here, because it reads
 * cookies through `next/headers`. Everything downstream is the real service:
 * each one opens its own tenant scope from the session this returns, and the
 * connection is an ordinary role, so the tenant policies decide what it sees.
 */
vi.mock("@/lib/auth/current", () => ({
  currentAuthContext: vi.fn()
}));

import { currentAuthContext } from "@/lib/auth/current";
import { createProject } from "@/lib/store/postgres";
import { createSowVersion, getSowOriginal, getSowWorkspace } from "@/lib/sow/service";
import { importManualMessages, listIngestionJobs } from "@/lib/ingestion/service";
import { parseManualImport } from "@/lib/ingestion/manual";
import { listIntegrations } from "@/lib/connectors/service";
import { auditLog, systemDiagnostics } from "@/lib/operations/diagnostics";
import { analysisWorkspace } from "@/lib/analysisJobs/context";

const ORGANIZATION_A = "60000000-0000-4000-8000-000000000001";
const ORGANIZATION_B = "60000000-0000-4000-8000-000000000002";
const USER_A = "60000000-0000-4000-8000-000000000011";
const USER_B = "60000000-0000-4000-8000-000000000012";

const AUTH_CONTEXT_A: AuthContext = {
  sessionId: "60000000-0000-4000-8000-000000000021",
  userId: USER_A,
  organizationId: ORGANIZATION_A,
  organizationName: "Harbour Consulting",
  email: "hana@example.com",
  displayName: "Hana Ortiz",
  role: "Owner",
  isSystemAdmin: true,
  expiresAt: "2099-01-01T00:00:00.000Z"
};

const AUTH_CONTEXT_B: AuthContext = {
  sessionId: "60000000-0000-4000-8000-000000000022",
  userId: USER_B,
  organizationId: ORGANIZATION_B,
  organizationName: "Kestrel Works",
  email: "kai@example.com",
  displayName: "Kai Lindqvist",
  role: "Owner",
  isSystemAdmin: true,
  expiresAt: "2099-01-01T00:00:00.000Z"
};

function actingAs(context: AuthContext) {
  vi.mocked(currentAuthContext).mockResolvedValue(context);
}

const SOW_TEXT = "1. Scope\nDeliver the reporting dashboard.\n2. Exclusions\nData migration is out of scope.";

let database: TestDatabase;
let projectA: string;
let projectB: string;
let uploadedVersionId: string;

beforeAll(async () => {
  database = await startTestDatabase();

  await withSystemAccess(async () => {
    await query(
      "INSERT INTO organizations (id, name, slug) VALUES ($1,$2,$3), ($4,$5,$6)",
      [ORGANIZATION_A, "Harbour Consulting", "harbour-consulting", ORGANIZATION_B, "Kestrel Works", "kestrel-works"]
    );
    await query(
      `INSERT INTO users (id, email, normalized_email, display_name)
       VALUES ($1,$2,$3,$4), ($5,$6,$7,$8)`,
      [USER_A, "hana@example.com", "hana@example.com", "Hana Ortiz",
       USER_B, "kai@example.com", "kai@example.com", "Kai Lindqvist"]
    );
    await query(
      "INSERT INTO organization_memberships (organization_id, user_id, role) VALUES ($1,$2,'Owner'), ($3,$4,'Owner')",
      [ORGANIZATION_A, USER_A, ORGANIZATION_B, USER_B]
    );

    for (const [organizationId, userId] of [[ORGANIZATION_A, USER_A], [ORGANIZATION_B, USER_B]]) {
      await query(
        `INSERT INTO backup_records (id, organization_id, status, created_by, manifest)
         VALUES ($1,$2,'Succeeded',$3,$4::jsonb)`,
        [randomUUID(), organizationId, userId, JSON.stringify({ kind: "scopeledger-installation" })]
      );
      await query(
        `INSERT INTO audit_logs (id, organization_id, actor_user_id, action, resource_type, resource_id)
         VALUES ($1,$2,$3,$4,'project',$5)`,
        [randomUUID(), organizationId, userId, `seeded.for.${organizationId}`, organizationId]
      );
    }
  });

  /**
   * Fixtures are built by the real services, but the scope is opened here
   * rather than left to the service under test. Otherwise a service that
   * failed to open one would break this setup and every assertion below would
   * be reported as skipped instead of failing on its own terms.
   */
  actingAs(AUTH_CONTEXT_A);
  projectA = (await withTenant(ORGANIZATION_A, () => createProject({
    client_name: "Harbour Client",
    project_name: "Reporting Dashboard",
    hourly_rate: 180,
    sow_text: SOW_TEXT
  }))).id;
  await withTenant(ORGANIZATION_A, () => importManualMessages({
    projectId: projectA,
    preview: parseManualImport({ format: "Text", content: "Please also add a second dashboard theme." })
  }));

  actingAs(AUTH_CONTEXT_B);
  projectB = (await withTenant(ORGANIZATION_B, () => createProject({
    client_name: "Kestrel Client",
    project_name: "Inventory Sync",
    hourly_rate: 150,
    sow_text: SOW_TEXT
  }))).id;
  await withTenant(ORGANIZATION_B, () => importManualMessages({
    projectId: projectB,
    preview: parseManualImport({ format: "Text", content: "Can you add barcode scanning too?" })
  }));
});

afterAll(async () => {
  await stopTestDatabase(database);
});

describe("the SOW service under row-level security", () => {
  it("returns the acting organization's workspace", async () => {
    actingAs(AUTH_CONTEXT_A);

    const workspace = await getSowWorkspace(projectA);

    expect(workspace?.activeVersion?.content).toBe(SOW_TEXT);
    expect(workspace?.sections.length).toBeGreaterThan(0);
  });

  it("reports another organization's project as absent rather than reading it", async () => {
    actingAs(AUTH_CONTEXT_B);

    expect(await getSowWorkspace(projectA)).toBeNull();
  });

  it("keeps the tenant scope open across the whole write, not just the session lookup", async () => {
    actingAs(AUTH_CONTEXT_A);

    const created = await createSowVersion({ projectId: projectA, text: `${SOW_TEXT}\n3. Support\nThirty days of support.` });
    const workspace = await getSowWorkspace(projectA);

    expect(created.versionNumber).toBe(2);
    expect(workspace?.activeVersion?.content).toContain("Thirty days of support.");
  });

  it("refuses to write a version onto another organization's project", async () => {
    actingAs(AUTH_CONTEXT_B);

    await expect(createSowVersion({ projectId: projectA, text: SOW_TEXT })).rejects.toThrow("Project not found.");
  });

  it("serves the uploaded original back to the organization that uploaded it", async () => {
    actingAs(AUTH_CONTEXT_A);

    const created = await createSowVersion({
      projectId: projectA,
      text: `${SOW_TEXT}\n4. Handover\nOne handover session is included.`,
      extracted: {
        text: SOW_TEXT,
        sourceType: "TXT",
        safeFilename: "signed-agreement.txt",
        mediaType: "text/plain",
        warning: null
      },
      fileBuffer: Buffer.from("the bytes the client actually signed")
    });

    const original = await getSowOriginal(projectA, created.versionId);

    expect(original?.filename).toBe("signed-agreement.txt");
    expect(original?.mediaType).toBe("text/plain");
    expect(Buffer.from(await new Response(original!.stream).arrayBuffer()).toString())
      .toBe("the bytes the client actually signed");

    uploadedVersionId = created.versionId;
  });

  it("reports another organization's original as absent rather than streaming it", async () => {
    actingAs(AUTH_CONTEXT_B);

    expect(await getSowOriginal(projectA, uploadedVersionId)).toBeNull();
    expect(await getSowOriginal(projectB, uploadedVersionId)).toBeNull();
  });

  it("will not serve an original through a project that does not own it", async () => {
    actingAs(AUTH_CONTEXT_A);

    expect(await getSowOriginal(projectB, uploadedVersionId)).toBeNull();
  });

  it("records no version when the write it belonged to never commits", async () => {
    actingAs(AUTH_CONTEXT_A);

    await expect(createSowVersion({
      projectId: "60000000-0000-4000-8000-0000000000ff",
      text: SOW_TEXT,
      extracted: {
        text: SOW_TEXT,
        sourceType: "TXT",
        safeFilename: "never-committed.txt",
        mediaType: "text/plain",
        warning: null
      },
      fileBuffer: Buffer.from("bytes that must not outlive the failed write")
    })).rejects.toThrow("Project not found.");

    const orphans = await withTenant(ORGANIZATION_A, () => query<{ count: number }>(
      "SELECT count(*)::int AS count FROM sow_versions WHERE source_filename = $1",
      ["never-committed.txt"]
    ));

    expect(orphans.rows[0].count).toBe(0);
  });

  it("stores no original for a version that was pasted rather than uploaded", async () => {
    actingAs(AUTH_CONTEXT_A);

    const created = await createSowVersion({ projectId: projectA, text: `${SOW_TEXT}\n5. Training\nTwo training hours.` });

    expect(await getSowOriginal(projectA, created.versionId)).toBeNull();
  });
});

describe("the ingestion service under row-level security", () => {
  it("lists only the acting organization's ingestion jobs", async () => {
    actingAs(AUTH_CONTEXT_A);

    const jobs = await listIngestionJobs();

    expect(jobs.length).toBe(1);
    expect(jobs.every((job) => job.project_id === projectA)).toBe(true);
  });

  it("refuses to import into another organization's project", async () => {
    actingAs(AUTH_CONTEXT_B);

    await expect(importManualMessages({
      projectId: projectA,
      preview: parseManualImport({ format: "Text", content: "Planted by the wrong tenant." })
    })).rejects.toThrow("Project not found.");
  });
});

describe("the connectors service under row-level security", () => {
  it("lists only the acting organization's connections", async () => {
    actingAs(AUTH_CONTEXT_A);

    const integrations = await listIntegrations();

    expect(integrations.map((row) => row.name)).toEqual(["Manual imports"]);
  });
});

describe("the diagnostics service under row-level security", () => {
  it("returns only the acting organization's audit entries", async () => {
    actingAs(AUTH_CONTEXT_A);

    const entries = await auditLog(100);

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((entry) => entry.action === `seeded.for.${ORGANIZATION_B}`)).toBe(false);
    expect(entries.some((entry) => entry.action === `seeded.for.${ORGANIZATION_A}`)).toBe(true);
  });

  it("reports the schema as fully migrated with nothing pending", async () => {
    actingAs(AUTH_CONTEXT_A);

    const diagnostics = await systemDiagnostics();

    expect(diagnostics.migrations.pending).toEqual([]);
    expect(diagnostics.migrations.applied).toBe(diagnostics.migrations.expected);
    expect(diagnostics.application.database).toBe("reachable");
  });

  it("counts only the acting organization's jobs and connections", async () => {
    actingAs(AUTH_CONTEXT_B);

    const diagnostics = await systemDiagnostics();

    expect(diagnostics.organization.id).toBe(ORGANIZATION_B);
    expect(diagnostics.ingestionJobs).toEqual([{ status: "Succeeded", count: 1, latest: expect.anything() }]);
  });
});

describe("the analysis workspace under row-level security", () => {
  it("loads the acting organization's project", async () => {
    actingAs(AUTH_CONTEXT_A);

    const workspace = await analysisWorkspace(projectA);

    expect(workspace.messages.length).toBe(1);
  });

  it("reports another organization's project as absent", async () => {
    actingAs(AUTH_CONTEXT_B);

    await expect(analysisWorkspace(projectA)).rejects.toThrow("Project not found.");
  });
});
