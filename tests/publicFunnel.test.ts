import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  createLead: vi.fn(),
  createAuditRequest: vi.fn(),
  getPublicIntakeAvailability: vi.fn(),
}));

vi.mock("@/lib/store", () => storeMocks);

import { POST as createLead } from "@/app/api/leads/route";
import { POST as createAuditRequest } from "@/app/api/audit-requests/route";
import { requireSinglePublicOrganization } from "@/lib/publicIntake";
import { NotFoundError } from "@/lib/storeErrors";

const leadBody = {
  name: "Taylor Morgan",
  email: "taylor@example.test",
  company: "Example Advisory",
  website: "https://example.test",
  business_type: "Consultancy",
  team_size: "11-25",
  average_project_value: "50000",
  hourly_rate: "225",
  pain_point: "Small client requests are regularly delivered before scope is checked.",
  consent_to_contact: true
};
const intakeToken = "A".repeat(43);

function post(path: string, body: unknown, ip: string, cookie?: string) {
  return new Request(`http://local.test${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://local.test",
      "X-Forwarded-For": ip,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body)
  });
}

describe("public private-beta funnel", () => {
  beforeEach(() => {
    storeMocks.createLead.mockReset();
    storeMocks.createAuditRequest.mockReset();
    storeMocks.getPublicIntakeAvailability.mockReset();
    storeMocks.getPublicIntakeAvailability.mockResolvedValue({ enabled: true });
  });

  it("accepts only HTTP(S) prospect websites", async () => {
    const response = await createLead(
      post("/api/leads", { ...leadBody, website: "javascript:alert(1)" }, "198.51.100.10")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Website must start with http:// or https://."
    });
    expect(storeMocks.createLead).not.toHaveBeenCalled();
  });

  it("returns no identifiers and stores the continuation in an HttpOnly cookie", async () => {
    storeMocks.createLead.mockResolvedValue({
      id: "d986c9dc-67f0-438a-bc60-ff2086255bd2",
      ...leadBody,
      private_note: "must not be returned",
      intakeToken,
      intakeExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const response = await createLead(post("/api/leads", leadBody, "198.51.100.11"));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.headers.get("set-cookie")).toContain(`scopeledger_audit_intake=${intakeToken}`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("rejects audit intake without a credential before persistence", async () => {
    const response = await createAuditRequest(
      post("/api/audit-requests", {
        client_name: "Example Client",
        project_value: "50000",
        hourly_rate: "225",
        sow_text: "The consultancy will deliver one discovery workshop and a written roadmap.",
        message_export_text: "Can you also facilitate the implementation sessions?",
        suspected_scope_creep_notes: "Implementation was not included."
      }, "198.51.100.12")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Audit link is invalid or expired." });
    expect(storeMocks.createAuditRequest).not.toHaveBeenCalled();
  });

  it("returns a receipt without exposing stored audit materials", async () => {
    storeMocks.createAuditRequest.mockResolvedValue({
      auditRequest: { id: "private", sow_text: "private sow" },
      project: { id: "private-project" },
      importResult: { inserted: 1 },
    });

    const response = await createAuditRequest(
      post("/api/audit-requests", {
        client_name: "Example Client",
        project_value: "50000",
        hourly_rate: "225",
        sow_text: "The consultancy will deliver one discovery workshop and a written roadmap.",
        message_export_text: "Can you also facilitate the implementation sessions?",
        suspected_scope_creep_notes: "Implementation was not included."
      }, "198.51.100.13", `scopeledger_audit_intake=${intakeToken}`)
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true, importedCount: 1 });
    expect(response.headers.get("set-cookie")).toContain("scopeledger_audit_intake=");
  });

  it("returns a safe validation error for an expired continuation", async () => {
    storeMocks.createAuditRequest.mockRejectedValue(
      new NotFoundError("Audit link is invalid or expired.")
    );

    const response = await createAuditRequest(
      post("/api/audit-requests", {
        client_name: "Example Client",
        project_value: "50000",
        hourly_rate: "225",
        sow_text: "The consultancy will deliver one discovery workshop and a written roadmap.",
        message_export_text: "Can you also facilitate the implementation sessions?",
        suspected_scope_creep_notes: "Implementation was not included."
      }, "198.51.100.14", `scopeledger_audit_intake=${"B".repeat(43)}`)
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Audit link is invalid or expired."
    });
  });

  it("fails closed while public intake is disabled", async () => {
    storeMocks.getPublicIntakeAvailability.mockResolvedValue({ enabled: false });

    const response = await createLead(post("/api/leads", leadBody, "198.51.100.20"));

    expect(response.status).toBe(503);
    expect(storeMocks.createLead).not.toHaveBeenCalled();
  });
});

describe("public intake tenant selection", () => {
  it("fails closed unless exactly one organization enables public intake", () => {
    expect(() => requireSinglePublicOrganization([])).toThrow(/not configured/i);
    expect(() =>
      requireSinglePublicOrganization([{ id: "org-1" }, { id: "org-2" }])
    ).toThrow(/exactly one organization/i);
    expect(requireSinglePublicOrganization([{ id: "org-1" }])).toBe("org-1");
  });
});
