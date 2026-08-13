import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDemoStore } from "@/lib/demo";
import { validateProductionConfiguration } from "@/lib/config/runtime";
import { redactLogMetadata } from "@/lib/observability/logger";
import { buildSupportBundle } from "@/lib/operations/diagnostics";
import { generateFindingsCsv, generateReportDocument } from "@/lib/reports/generator";
import { REPORT_TYPES } from "@/lib/types";

afterEach(() => {
  vi.unstubAllEnvs();
});

function demoRows() {
  const store = buildDemoStore();
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
});

describe("production configuration and log safety", () => {
  const SCHEDULE_SECRET = "a-scheduled-secret-of-at-least-32-characters";

  const validInstallation = {
    DATABASE_URL: "postgresql://localhost/scopeledger",
    APP_URL: "http://127.0.0.1:3000",
    SCOPELEDGER_MASTER_KEY: Buffer.alloc(32).toString("base64"),
    CRON_SECRET: SCHEDULE_SECRET,
    BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_test_only",
    UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-only-token"
  };

  it("requires the API key of whichever cloud provider is selected", () => {
    expect(validateProductionConfiguration({ ...validInstallation })).toContain(
      "ANTHROPIC_API_KEY is required when Anthropic is the provider or fallback."
    );
    expect(validateProductionConfiguration({ ...validInstallation, AI_PROVIDER: "openai" })).toContain(
      "OPENAI_API_KEY is required when OpenAI is the provider or fallback."
    );
  });

  it("requires the API key of a provider named only as the fallback", () => {
    expect(
      validateProductionConfiguration({
        ...validInstallation,
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "test-only-key",
        AI_FALLBACK_PROVIDER: "anthropic"
      })
    ).toContain("ANTHROPIC_API_KEY is required when Anthropic is the provider or fallback.");
  });

  it("accepts an installation once the selected provider has its key", () => {
    expect(
      validateProductionConfiguration({ ...validInstallation, ANTHROPIC_API_KEY: "test-only-key" })
    ).toEqual([]);
  });

  it("refuses to start without the blob store an uploaded original would be written to", () => {
    const { BLOB_READ_WRITE_TOKEN: _omitted, ...withoutBlobStore } = validInstallation;

    expect(validateProductionConfiguration({ ...withoutBlobStore, ANTHROPIC_API_KEY: "test-only-key" })).toContain(
      "BLOB_READ_WRITE_TOKEN is required; without it an uploaded SOW original has nowhere to go."
    );
  });

  it("refuses to start without the credential the scheduled drain authenticates against", () => {
    const { CRON_SECRET: _omitted, ...withoutSchedule } = validInstallation;

    expect(validateProductionConfiguration({ ...withoutSchedule, ANTHROPIC_API_KEY: "test-only-key" })).toContain(
      "CRON_SECRET is required; without it the scheduled drain refuses every caller and an interrupted analysis job is never recovered."
    );
    expect(
      validateProductionConfiguration({ ...validInstallation, CRON_SECRET: "too-short", ANTHROPIC_API_KEY: "test-only-key" })
    ).toContain("CRON_SECRET must be at least 32 characters.");
  });

  /**
   * The two unauthenticated endpoints have nothing but this limit protecting
   * them, and a limit each instance counts on its own is the configured one
   * multiplied by however many are warm.
   */
  it("refuses to start without the shared counter the public endpoints are limited by", () => {
    const { UPSTASH_REDIS_REST_URL: _url, UPSTASH_REDIS_REST_TOKEN: _token, ...withoutCounter } = validInstallation;

    expect(validateProductionConfiguration({ ...withoutCounter, ANTHROPIC_API_KEY: "test-only-key" })).toContain(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required; without them each running instance counts rate limits on its own and the limit an attacker meets is multiplied by however many are warm."
    );
  });

  it("starts for a deployment provisioned through the Vercel marketplace", () => {
    const { UPSTASH_REDIS_REST_URL: _url, UPSTASH_REDIS_REST_TOKEN: _token, ...withoutCounter } = validInstallation;

    expect(validateProductionConfiguration({
      ...withoutCounter,
      KV_REST_API_URL: "https://example.upstash.io",
      KV_REST_API_TOKEN: "test-only-token",
      ANTHROPIC_API_KEY: "test-only-key"
    })).toEqual([]);
  });

  /**
   * Encryption without an identity check protects the traffic from somebody
   * listening and hands the database password to anybody able to answer in the
   * server's place, which is the attack worth caring about.
   */
  it("refuses a hosted database reached without verifying who answered", () => {
    const identityUnverified = "The database connection must verify the server's identity: add sslmode=verify-full to DATABASE_URL. Encryption without that check protects the traffic from a passive eavesdropper while handing the credentials to anyone able to answer in the server's place.";

    for (const sslmode of ["require", "prefer", "verify-ca", "no-verify", "disable"]) {
      expect(validateProductionConfiguration({
        ...validInstallation,
        DATABASE_URL: `postgresql://db.example.com/scopeledger?sslmode=${sslmode}`,
        ANTHROPIC_API_KEY: "test-only-key"
      })).toContain(identityUnverified);
    }

    expect(validateProductionConfiguration({
      ...validInstallation,
      DATABASE_URL: "postgresql://db.example.com/scopeledger?sslmode=verify-full",
      ANTHROPIC_API_KEY: "test-only-key"
    })).toEqual([]);
  });

  it("accepts a hosted database whose URL says nothing, when DATABASE_SSL asks for verification", () => {
    expect(validateProductionConfiguration({
      ...validInstallation,
      DATABASE_URL: "postgresql://db.example.com/scopeledger",
      DATABASE_SSL: "require",
      ANTHROPIC_API_KEY: "test-only-key"
    })).toEqual([]);
  });

  it("refuses a hosted database when neither the URL nor DATABASE_SSL asks for anything", () => {
    expect(validateProductionConfiguration({
      ...validInstallation,
      DATABASE_URL: "postgresql://db.example.com/scopeledger",
      ANTHROPIC_API_KEY: "test-only-key"
    })).not.toEqual([]);
  });

  /**
   * DATABASE_SSL is overwritten by anything the URL says, so it cannot rescue a
   * connection string that has already asked for something weaker.
   */
  it("does not let DATABASE_SSL rescue a URL that asked for less", () => {
    expect(validateProductionConfiguration({
      ...validInstallation,
      DATABASE_URL: "postgresql://db.example.com/scopeledger?sslmode=require",
      DATABASE_SSL: "require",
      ANTHROPIC_API_KEY: "test-only-key"
    })).not.toEqual([]);
  });

  it("leaves a loopback database alone, which never crosses a network", () => {
    expect(validateProductionConfiguration({
      ...validInstallation,
      DATABASE_URL: "postgresql://127.0.0.1:5432/scopeledger",
      ANTHROPIC_API_KEY: "test-only-key"
    })).toEqual([]);
  });

  it("rejects a provider that is not in the catalog", () => {
    expect(validateProductionConfiguration({ ...validInstallation, AI_PROVIDER: "gemini" })).toContain(
      "AI_PROVIDER must be one of anthropic, openai."
    );
  });

  it("fails closed when production storage or origin configuration is missing", () => {
    expect(validateProductionConfiguration({})).toEqual(
      expect.arrayContaining(["DATABASE_URL is required.", "APP_URL is required for secure links and origin-aware operations."])
    );
    expect(
      validateProductionConfiguration({
        DATABASE_URL: "postgresql://localhost/scopeledger",
        APP_URL: "http://127.0.0.1:3000",
        SCOPELEDGER_MASTER_KEY: Buffer.alloc(32).toString("base64"),
        CRON_SECRET: SCHEDULE_SECRET,
        BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_test_only",
        UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "test-only-token",
        ANTHROPIC_API_KEY: "test-only-key"
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
      AI_PROVIDER: "openai",
      AI_MAX_ATTEMPTS: "zero",
      ALLOW_INSECURE_IMAP: "yes"
    })).toEqual(expect.arrayContaining([
      "OPENAI_API_KEY is required when OpenAI is the provider or fallback.",
      "AI_MAX_ATTEMPTS must be a positive integer.",
      "ALLOW_INSECURE_IMAP must be true or false."
    ]));
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
