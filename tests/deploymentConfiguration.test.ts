import { describe, expect, it } from "vitest";
import { assertDeployableConfiguration } from "@/lib/config/deployment";

const COMPLETE_PRODUCTION_ENVIRONMENT = {
  VERCEL_ENV: "production",
  DATABASE_URL: "postgresql://localhost/scopeledger",
  APP_URL: "https://scopeledger.example",
  SCOPELEDGER_MASTER_KEY: Buffer.alloc(32).toString("base64"),
  CRON_SECRET: "a-scheduled-secret-of-at-least-32-characters",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_test_only",
  ANTHROPIC_API_KEY: "test-only-key"
};

describe("a production deployment refuses to build on a configuration it could not run", () => {
  it("names every missing requirement rather than the first one", () => {
    expect(() => assertDeployableConfiguration({ VERCEL_ENV: "production" }))
      .toThrow(/DATABASE_URL is required[\s\S]*BLOB_READ_WRITE_TOKEN is required/);
  });

  it("builds once the configuration is complete", () => {
    expect(() => assertDeployableConfiguration(COMPLETE_PRODUCTION_ENVIRONMENT)).not.toThrow();
  });

  it("leaves preview and local builds alone, which have no production secrets to check", () => {
    expect(() => assertDeployableConfiguration({ VERCEL_ENV: "preview" })).not.toThrow();
    expect(() => assertDeployableConfiguration({})).not.toThrow();
  });
});
