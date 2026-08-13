import { afterEach, describe, expect, it, vi } from "vitest";
import { assertScheduledCaller, ScheduledCallerError } from "@/lib/auth/scheduled";

afterEach(() => vi.unstubAllEnvs());

function callerOffering(secret?: string) {
  return new Request("http://local.test/api/cron/analysis-jobs", {
    headers: secret === undefined ? {} : { authorization: `Bearer ${secret}` }
  });
}

describe("admitting the scheduler to the queue drain", () => {
  it("admits a caller offering the configured secret", () => {
    vi.stubEnv("CRON_SECRET", "a-long-scheduled-work-secret");

    expect(() => assertScheduledCaller(callerOffering("a-long-scheduled-work-secret"))).not.toThrow();
  });

  /**
   * A deployment that forgot the variable must refuse everyone, and the caller
   * that exposes it is the one offering nothing: an empty credential matches an
   * empty secret unless the absent configuration is refused first.
   */
  it("refuses every caller when no secret is configured", () => {
    vi.stubEnv("CRON_SECRET", "");

    expect(() => assertScheduledCaller(callerOffering("anything"))).toThrow(ScheduledCallerError);
    expect(() => assertScheduledCaller(callerOffering(""))).toThrow(ScheduledCallerError);
    expect(() => assertScheduledCaller(callerOffering())).toThrow(ScheduledCallerError);
  });

  it("refuses a caller that offers nothing", () => {
    vi.stubEnv("CRON_SECRET", "a-long-scheduled-work-secret");

    expect(() => assertScheduledCaller(callerOffering())).toThrow(ScheduledCallerError);
  });

  /**
   * The offered value is the same length as the real one, so nothing but the
   * comparison of the bytes themselves can reject it.
   */
  it("refuses a caller offering a wrong secret of the same length", () => {
    vi.stubEnv("CRON_SECRET", "a-long-scheduled-work-secret");

    expect(() => assertScheduledCaller(callerOffering("b-long-scheduled-work-secret"))).toThrow(ScheduledCallerError);
    expect(() => assertScheduledCaller(callerOffering("a-long-scheduled-work-secreZ"))).toThrow(ScheduledCallerError);
  });

  /**
   * A prefix is the shape a guessing attack takes when the comparison stops at
   * the first wrong byte, so it is checked separately from an unrelated value.
   */
  it("refuses a caller offering a prefix of the secret", () => {
    vi.stubEnv("CRON_SECRET", "a-long-scheduled-work-secret");

    expect(() => assertScheduledCaller(callerOffering("a-long-scheduled"))).toThrow(ScheduledCallerError);
  });

  it("refuses a caller sending the secret without the bearer scheme", () => {
    vi.stubEnv("CRON_SECRET", "a-long-scheduled-work-secret");
    const request = new Request("http://local.test/api/cron/analysis-jobs", {
      headers: { authorization: "a-long-scheduled-work-secret" }
    });

    expect(() => assertScheduledCaller(request)).toThrow(ScheduledCallerError);
  });
});
