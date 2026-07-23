import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  createLead: vi.fn(),
  createAuditRequest: vi.fn()
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

function post(path: string, body: unknown, ip: string) {
  return new Request(`http://local.test${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://local.test",
      "X-Forwarded-For": ip
    },
    body: JSON.stringify(body)
  });
}

describe("public private-beta funnel", () => {
  beforeEach(() => {
    storeMocks.createLead.mockReset();
    storeMocks.createAuditRequest.mockReset();
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

  it("returns only the continuation id after saving a lead", async () => {
    storeMocks.createLead.mockResolvedValue({
      id: "d986c9dc-67f0-438a-bc60-ff2086255bd2",
      ...leadBody,
      private_note: "must not be returned"
    });

    const response = await createLead(post("/api/leads", leadBody, "198.51.100.11"));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      lead: { id: "d986c9dc-67f0-438a-bc60-ff2086255bd2" }
    });
  });

  it("rejects malformed lead continuation ids before persistence", async () => {
    const response = await createAuditRequest(
      post("/api/audit-requests", {
        lead_id: "not-an-id",
        client_name: "Example Client",
        project_value: "50000",
        hourly_rate: "225",
        sow_text: "The consultancy will deliver one discovery workshop and a written roadmap.",
        message_export_text: "Can you also facilitate the implementation sessions?",
        suspected_scope_creep_notes: "Implementation was not included."
      }, "198.51.100.12")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Audit link is invalid." });
    expect(storeMocks.createAuditRequest).not.toHaveBeenCalled();
  });

  it("returns a receipt without exposing stored audit materials", async () => {
    storeMocks.createAuditRequest.mockResolvedValue({
      auditRequest: { id: "private", sow_text: "private sow" },
      project: { id: "private-project" }
    });

    const response = await createAuditRequest(
      post("/api/audit-requests", {
        lead_id: "d986c9dc-67f0-438a-bc60-ff2086255bd2",
        client_name: "Example Client",
        project_value: "50000",
        hourly_rate: "225",
        sow_text: "The consultancy will deliver one discovery workshop and a written roadmap.",
        message_export_text: "Can you also facilitate the implementation sessions?",
        suspected_scope_creep_notes: "Implementation was not included."
      }, "198.51.100.13")
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns a safe validation error for an expired continuation", async () => {
    storeMocks.createAuditRequest.mockRejectedValue(
      new NotFoundError("Audit link is invalid or expired.")
    );

    const response = await createAuditRequest(
      post("/api/audit-requests", {
        lead_id: "d986c9dc-67f0-438a-bc60-ff2086255bd2",
        client_name: "Example Client",
        project_value: "50000",
        hourly_rate: "225",
        sow_text: "The consultancy will deliver one discovery workshop and a written roadmap.",
        message_export_text: "Can you also facilitate the implementation sessions?",
        suspected_scope_creep_notes: "Implementation was not included."
      }, "198.51.100.14")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Audit link is invalid or expired."
    });
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
