import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDemoStore } from "@/lib/demo";
import { validateProductionConfiguration } from "@/lib/config/runtime";
import { shouldUseSecureSessionCookie } from "@/lib/auth/sessionConfig";
import { redactLogMetadata } from "@/lib/observability/logger";
import { buildSupportBundle } from "@/lib/operations/diagnostics";
import {
  createInstallationBackup,
  inspectBackupBundle,
  restoreInstallationBackup,
  type BackupManifest
} from "@/lib/backups/native";
import { generateFindingsCsv, generateReportDocument } from "@/lib/reports/generator";
import { REPORT_TYPES } from "@/lib/types";

const run = promisify(execFile);
const temporaryDirectories: string[] = [];
const originalBackupDirectory = process.env.SCOPELEDGER_BACKUP_DIR;
const originalDocumentDirectory = process.env.SCOPELEDGER_DOCUMENT_DIR;
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalPgRestorePath = process.env.PG_RESTORE_PATH;

afterEach(async () => {
  vi.unstubAllEnvs();

  if (originalBackupDirectory === undefined) delete process.env.SCOPELEDGER_BACKUP_DIR;
  else process.env.SCOPELEDGER_BACKUP_DIR = originalBackupDirectory;

  if (originalDocumentDirectory === undefined) delete process.env.SCOPELEDGER_DOCUMENT_DIR;
  else process.env.SCOPELEDGER_DOCUMENT_DIR = originalDocumentDirectory;

  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;

  if (originalPgRestorePath === undefined) delete process.env.PG_RESTORE_PATH;
  else process.env.PG_RESTORE_PATH = originalPgRestorePath;

  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

function demoRows() {
  const store = structuredClone(buildDemoStore());
  const project = store.projects[0];
  const findings = new Map(store.scopeFindings.map((finding) => [finding.client_message_id, finding]));

  return {
    project,
    rows: store.clientMessages
      .filter((message) => message.project_id === project.id)
      .map((message) => ({ message, finding: findings.get(message.id) || null }))
  };
}

describe("versioned report generation", () => {
  it("generates every supported report type without implying automatic delivery", () => {
    const { project, rows } = demoRows();

    for (const reportType of REPORT_TYPES) {
      const report = generateReportDocument({ project, rows, reportType });

      expect(report).toContain(reportType);
      expect(report).toMatch(/never sends|manual invoicing only/i);

      if (["Client Discussion Brief", "Change Order Draft"].includes(reportType)) {
        expect(report).toContain("DRAFT");
      }
    }
  });

  it("neutralizes spreadsheet formulas in CSV exports", () => {
    const { project, rows } = demoRows();

    rows[0].message.message_text = "=HYPERLINK(\"https://attacker.example\")";
    const csv = generateFindingsCsv(project, rows);

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain('\n"=HYPERLINK');
  });

  it("neutralizes active HTML and Markdown controls in report source text", () => {
    const { project, rows } = demoRows();

    rows[0].message.message_text = "<script>alert(1)</script>\n# Injected heading";
    const report = generateReportDocument({ project, rows, reportType: "Finding Summary" });

    expect(report).not.toContain("<script>");
    expect(report).not.toContain("\n# Injected heading");
    expect(report).toContain("&lt;script&gt;");
    expect(report).toContain("\\# Injected heading");
  });

  it("uses only professional-approved values in client-facing commercial reports", () => {
    const { project, rows } = demoRows();
    const approved = rows.find((row) => row.finding?.billing_decision === "Bill Separately");

    expect(approved?.finding).toBeTruthy();
    approved!.finding!.estimated_hours = 999;
    approved!.finding!.estimated_revenue = 999999;
    approved!.finding!.approved_hours = 3.5;
    approved!.finding!.approved_amount_cents = 12345;
    approved!.finding!.client_facing_explanation = "AI draft asks for $999,999 and 999 hours.";

    const changeOrder = generateReportDocument({ project, rows, reportType: "Change Order Draft" });
    const invoiceSupport = generateReportDocument({ project, rows, reportType: "Invoice Support Summary" });

    expect(changeOrder).toContain("Professional-approved effort: 3.5 hours");
    expect(changeOrder).toContain("Professional-approved amount: $123.45");
    expect(changeOrder).not.toContain("Estimated additional effort: 999 hours");
    expect(changeOrder).not.toContain("Estimated amount:");
    expect(changeOrder).not.toContain("AI draft asks for $999,999");
    expect(invoiceSupport).toContain("Approved amount: $123.45");
    expect(invoiceSupport).not.toContain("999999");
  });

  it("labels discussion drafts unapproved and excludes missing amounts from invoice support", () => {
    const { project, rows } = demoRows();
    const discussion = rows.find((row) => row.finding?.billing_decision === "Discuss With Client");
    const invoiceCandidate = rows.find((row) => row.finding?.billing_decision === "Bill Separately");

    expect(discussion?.finding).toBeTruthy();
    expect(invoiceCandidate?.finding).toBeTruthy();
    invoiceCandidate!.finding!.approved_amount_cents = null;

    const changeOrder = generateReportDocument({ project, rows, reportType: "Change Order Draft" });
    const invoiceSupport = generateReportDocument({ project, rows, reportType: "Invoice Support Summary" });

    expect(changeOrder).toContain("UNAPPROVED - No price or effort is authorized for client use.");
    expect(changeOrder).not.toContain(`Professional-approved amount: $${invoiceCandidate!.finding!.estimated_revenue}`);
    expect(invoiceSupport).not.toContain(invoiceCandidate!.message.message_text);
    expect(invoiceSupport).not.toContain("Approved amount: $0.00");
  });

  it("generates a weekly summary with exclusive approved buckets and monitoring health", () => {
    const { project, rows } = demoRows();

    rows[0].message.created_at = "2026-05-01T12:00:00.000Z";
    const report = generateReportDocument({
      project,
      rows,
      reportType: "Weekly Monitoring Summary",
      generatedAt: new Date("2026-06-06T12:00:00.000Z"),
      monitoring: {
        automation: {
          status: "Active",
          lastSucceededAt: "2026-06-06T10:00:00.000Z",
          nextRunAt: "2026-06-06T12:15:00.000Z",
          lastError: null
        },
        connectors: [{
          provider: "Slack",
          status: "Connected",
          lastSyncedAt: "2026-06-06T10:00:00.000Z",
          lastError: null
        }]
      }
    });

    expect(report).toContain("New messages: 11");
    expect(report).toContain("New findings: 12");
    expect(report).toContain("Approved for billing, not invoiced: $1,750.00");
    expect(report).toContain("Invoiced, not paid: $4,900.00");
    expect(report).toContain("Paid: $2,100.00");
    expect(report).toContain("Automation: Active");
    expect(report).toContain("Slack: Connected");
    expect(report).toContain("mutually exclusive");
  });
});

describe("production configuration and log safety", () => {
  it("fails closed when production storage or origin configuration is missing", () => {
    expect(validateProductionConfiguration({})).toEqual(
      expect.arrayContaining(["DATABASE_URL is required.", "APP_URL is required for secure links and origin-aware operations."])
    );
    expect(
      validateProductionConfiguration({
        DATABASE_URL: "postgresql://localhost/scopeledger",
        APP_URL: "http://127.0.0.1:3000",
        SCOPELEDGER_MASTER_KEY: Buffer.alloc(32).toString("base64")
      })
    ).toEqual([]);
    expect(
      validateProductionConfiguration({
        DATABASE_URL: "postgresql://localhost/scopeledger",
        APP_URL: "http://127.0.0.1:3000",
        SCOPELEDGER_MASTER_KEY: `${Buffer.alloc(32).toString("base64")}not-base64`
      })
    ).toContain("SCOPELEDGER_MASTER_KEY must be canonical base64 for exactly 32 bytes.");
    expect(validateProductionConfiguration({})).toContain(
      "SCOPELEDGER_MASTER_KEY is required to protect integration credentials."
    );
    expect(validateProductionConfiguration({
      DATABASE_URL: "postgresql://localhost/scopeledger",
      APP_URL: "http://192.168.1.20:3000",
      SCOPELEDGER_MASTER_KEY: Buffer.alloc(32).toString("base64"),
      AI_PROVIDER: "demo"
    })).toEqual(expect.arrayContaining([
      "APP_URL must use HTTPS unless the installation is bound to loopback.",
      "AI_PROVIDER=demo is test-only and cannot be used for a commercial production start."
    ]));
    expect(validateProductionConfiguration({
      DATABASE_URL: "postgresql://localhost/scopeledger",
      APP_URL: "http://127.0.0.1:3000",
      SCOPELEDGER_MASTER_KEY: Buffer.alloc(32).toString("base64"),
      SCOPELEDGER_DOCUMENT_DIR: "/private/scopeledger",
      SCOPELEDGER_BACKUP_DIR: "/private/scopeledger/backups"
    })).toContain("SCOPELEDGER_DOCUMENT_DIR and SCOPELEDGER_BACKUP_DIR must not overlap.");
    expect(validateProductionConfiguration({
      DATABASE_URL: "postgresql://localhost/scopeledger",
      APP_URL: "http://127.0.0.1:3000",
      SCOPELEDGER_MASTER_KEY: Buffer.alloc(32).toString("base64"),
      AI_PROVIDER: "openai",
      AI_MAX_ATTEMPTS: "zero",
      ALLOW_INSECURE_IMAP: "yes"
    })).toEqual(expect.arrayContaining([
      "OPENAI_API_KEY is required when OpenAI is the provider or fallback.",
      "AI_MAX_ATTEMPTS must be a positive integer.",
      "ALLOW_INSECURE_IMAP must be true or false."
    ]));
  });

  it("uses secure cookies for HTTPS and permits explicit loopback HTTP setup", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://scopeledger.example");
    expect(shouldUseSecureSessionCookie()).toBe(true);
    vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
    expect(shouldUseSecureSessionCookie()).toBe(false);
  });

  it("redacts nested credentials and sensitive business text", () => {
    expect(
      redactLogMetadata({
        projectId: "project-1",
        accessToken: "secret-token",
        nested: { sowContent: "private contract", messageBody: "private request" }
      })
    ).toEqual({
      projectId: "project-1",
      accessToken: "[REDACTED]",
      nested: { sowContent: "[REDACTED]", messageBody: "[REDACTED]" }
    });
    expect(
      redactLogMetadata({
        error: new Error("failed postgresql://admin:private@db.local/scopeledger with Bearer abc123"),
        senderEmail: "real.person@example.com"
      })
    ).toEqual({
      error: {
        name: "Error",
        message: "failed postgresql://[REDACTED]@db.local/scopeledger with Bearer [REDACTED]"
      },
      senderEmail: "[REDACTED]"
    });

    const support = buildSupportBundle(
      {
        organization: { id: "org-private", name: "Private Firm" },
        jobs: [{ status: "Failed", messageBody: "private client request" }]
      },
      [{ metadata: { ownerEmail: "owner@private.example", accessToken: "token" } }]
    );

    expect(support.diagnostics.organization).toEqual({ id: "[REDACTED]", name: "[REDACTED]" });
    expect(JSON.stringify(support)).not.toContain("Private Firm");
    expect(JSON.stringify(support)).not.toContain("owner@private.example");
    expect(JSON.stringify(support)).not.toContain("private client request");
  });
});

describe("backup integrity", () => {
  it("rejects overlapping backup and private-document directories without leaving partial work", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "scopeledger-overlap-test-"));

    temporaryDirectories.push(root);
    process.env.SCOPELEDGER_BACKUP_DIR = root;
    process.env.SCOPELEDGER_DOCUMENT_DIR = root;
    process.env.DATABASE_URL = "postgresql://user:password@127.0.0.1:5432/scopeledger";
    await expect(createInstallationBackup()).rejects.toThrow(/must not overlap/);
    expect((await fs.readdir(root)).filter((entry) => entry.startsWith("scopeledger-"))).toEqual([]);
  });

  it("validates database and document checksums before restore", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "scopeledger-backup-test-"));

    temporaryDirectories.push(root);
    process.env.SCOPELEDGER_BACKUP_DIR = root;
    const source = path.join(root, "source");

    await fs.mkdir(source);
    const database = Buffer.from("fictional database dump");
    const documentSource = path.join(root, "documents");

    await fs.mkdir(documentSource);
    await fs.writeFile(path.join(documentSource, "fictional-sow.txt"), "fictional document");
    await run("tar", ["-czf", path.join(source, "documents.tar.gz"), "-C", documentSource, "."]);
    const documents = await fs.readFile(path.join(source, "documents.tar.gz"));

    await fs.writeFile(path.join(source, "database.dump"), database);
    const manifest: BackupManifest = {
      kind: "scopeledger-installation",
      backupVersion: 1,
      appVersion: "0.1.0",
      createdAt: "2026-07-22T00:00:00.000Z",
      latestMigration: "008_reports_operations_security.sql",
      complete: true,
      database: {
        file: "database.dump",
        bytes: database.length,
        sha256: createHash("sha256").update(database).digest("hex")
      },
      documents: {
        requiredFiles: 1,
        file: "documents.tar.gz",
        format: "directory-contents-v1",
        bytes: documents.length,
        sha256: createHash("sha256").update(documents).digest("hex")
      },
      encryptedSecretsCovered: true
    };

    await fs.writeFile(path.join(source, "manifest.json"), JSON.stringify(manifest));
    const bundle = path.join(root, "verified.tar.gz");

    await run("tar", ["-czf", bundle, "-C", source, "."]);

    const inspected = await inspectBackupBundle(bundle);

    expect(inspected.manifest.complete).toBe(true);
    await fs.rm(inspected.temporary, { recursive: true, force: true });

    const restoreTool = path.join(root, "mock-pg-restore.sh");
    const restoredDocuments = path.join(root, "restored-documents");

    await fs.writeFile(restoreTool, "#!/bin/sh\nexit 0\n", { mode: 0o700 });
    await fs.mkdir(restoredDocuments);
    await fs.writeFile(path.join(restoredDocuments, "old-private-file.txt"), "previous install");
    process.env.DATABASE_URL = "postgresql://user:password@127.0.0.1:5432/scopeledger";
    process.env.PG_RESTORE_PATH = restoreTool;
    process.env.SCOPELEDGER_DOCUMENT_DIR = restoredDocuments;
    const restored = await restoreInstallationBackup(bundle);

    expect(restored.createdAt).toBe(manifest.createdAt);
    await expect(fs.readFile(path.join(restoredDocuments, "fictional-sow.txt"), "utf8"))
      .resolves.toBe("fictional document");
    await expect(fs.stat(path.join(restoredDocuments, "old-private-file.txt"))).rejects.toThrow();

    await fs.writeFile(path.join(source, "database.dump"), "tampered");
    await run("tar", ["-czf", bundle, "-C", source, "."]);
    await expect(inspectBackupBundle(bundle)).rejects.toThrow(/checksum validation failed/);
    const leftovers = (await fs.readdir(root)).filter((entry) => entry.startsWith(".restore-"));

    expect(leftovers).toEqual([]);
  });
});
