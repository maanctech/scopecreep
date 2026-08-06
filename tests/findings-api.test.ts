import { promises as fs } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { GET as getFindingRoute, PATCH as patchFindingRoute } from "@/app/api/findings/[id]/route";
import { POST as postActionRoute } from "@/app/api/findings/[id]/actions/route";
import { GET as getFindingEventsRoute } from "@/app/api/findings/[id]/billing-events/route";
import { GET as getBillingEventsRoute } from "@/app/api/billing-events/route";
import {
  GET as getReportRoute,
  POST as postReportRoute
} from "@/app/api/projects/[id]/report/route";
import { DEMO_PROJECT_ID } from "@/lib/demo";
import { resetLocalDemoStore } from "@/lib/store";

const dataFile = path.join(process.cwd(), "data", "demo-store.json");

// Seeded demo finding ids (index + 1 within the 12 demo messages).
const SECURITY_FINDING = "44444444-4444-4444-8444-444444444409"; // Needs Review, $525
const PRODUCT_TOUR_FINDING = "44444444-4444-4444-8444-444444444410"; // Needs Review, $700
const HUBSPOT_FINDING = "44444444-4444-4444-8444-444444444405"; // Decided (Bill Separately)
const MISSING_FINDING = "44444444-4444-4444-8444-444444444499";

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function jsonRequest(method: string, body?: unknown) {
  if (method === "GET" || body === undefined || body === "") {
    return new Request("http://localhost/api/test", { method });
  }

  return new Request("http://localhost/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
}

async function readStoreFile() {
  return JSON.parse(await fs.readFile(dataFile, "utf8"));
}

beforeAll(async () => {
  await resetLocalDemoStore();
});

describe("finding read APIs", () => {
  it("returns a finding with its history", async () => {
    const response = await getFindingRoute(jsonRequest("GET", ""), params(HUBSPOT_FINDING));

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.finding.billing_decision).toBe("Bill Separately");
    expect(json.finding.approved_amount_cents).toBe(175000);
    expect(json.events.length).toBeGreaterThan(0);
  });

  it("returns 404 for a missing finding", async () => {
    const response = await getFindingRoute(jsonRequest("GET", ""), params(MISSING_FINDING));

    expect(response.status).toBe(404);
    const events = await getFindingEventsRoute(jsonRequest("GET", ""), params(MISSING_FINDING));

    expect(events.status).toBe(404);
  });
});

describe("PATCH /api/findings/[id]", () => {
  it("rejects malformed JSON with 400", async () => {
    const response = await patchFindingRoute(
      jsonRequest("PATCH", "{not json"),
      params(HUBSPOT_FINDING)
    );

    expect(response.status).toBe(400);
  });

  it("rejects unknown fields and invalid values with 400", async () => {
    const unknownField = await patchFindingRoute(
      jsonRequest("PATCH", { expected_version: 1, workflow_status: "Paid" }),
      params(HUBSPOT_FINDING)
    );

    expect(unknownField.status).toBe(400);

    const fractionalCents = await patchFindingRoute(
      jsonRequest("PATCH", { expected_version: 1, approved_amount_cents: 100.5 }),
      params(HUBSPOT_FINDING)
    );

    expect(fractionalCents.status).toBe(400);
  });

  it("returns 404 for a missing finding", async () => {
    const response = await patchFindingRoute(
      jsonRequest("PATCH", { expected_version: 1, internal_note: "note" }),
      params(MISSING_FINDING)
    );

    expect(response.status).toBe(404);
  });

  it("rejects stale versions with 409", async () => {
    const response = await patchFindingRoute(
      jsonRequest("PATCH", { expected_version: 99, internal_note: "stale" }),
      params(HUBSPOT_FINDING)
    );

    expect(response.status).toBe(409);
  });

  it("blocks amount edits before a billing decision", async () => {
    const response = await patchFindingRoute(
      jsonRequest("PATCH", { expected_version: 1, approved_amount_cents: 120000 }),
      params(SECURITY_FINDING)
    );

    expect(response.status).toBe(400);
  });

  it("updates approved amounts on a decided finding and records history", async () => {
    const response = await patchFindingRoute(
      jsonRequest("PATCH", {
        expected_version: 1,
        approved_hours: 11,
        approved_amount_cents: 180000,
        internal_note: "Negotiated up after reviewing effort."
      }),
      params(HUBSPOT_FINDING)
    );

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.finding.approved_amount_cents).toBe(180000);
    expect(json.finding.version).toBe(2);

    const events = await getFindingEventsRoute(jsonRequest("GET", ""), params(HUBSPOT_FINDING));
    const eventsJson = await events.json();
    const estimateUpdated = eventsJson.events.find(
      (event: { event_type: string }) => event.event_type === "Estimate Updated"
    );

    expect(estimateUpdated).toBeDefined();
    expect(estimateUpdated.previous_amount_cents).toBe(175000);
    expect(estimateUpdated.new_amount_cents).toBe(180000);
  });
});

describe("POST /api/findings/[id]/actions", () => {
  it("rejects unknown actions with 400", async () => {
    const response = await postActionRoute(
      jsonRequest("POST", { action: "Delete Finding", expected_version: 1 }),
      params(SECURITY_FINDING)
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 for a missing finding", async () => {
    const response = await postActionRoute(
      jsonRequest("POST", { action: "Mark as Billable", expected_version: 1 }),
      params(MISSING_FINDING)
    );

    expect(response.status).toBe(404);
  });

  it("blocks invalid transitions with 400", async () => {
    const paidTooEarly = await postActionRoute(
      jsonRequest("POST", { action: "Mark as Paid", expected_version: 1 }),
      params(SECURITY_FINDING)
    );

    expect(paidTooEarly.status).toBe(400);

    const invoicedWithoutDecision = await postActionRoute(
      jsonRequest("POST", { action: "Mark as Invoiced", expected_version: 1 }),
      params(SECURITY_FINDING)
    );

    expect(invoicedWithoutDecision.status).toBe(400);
  });

  it("walks a finding through billable, invoiced, and paid with version checks", async () => {
    const billable = await postActionRoute(
      jsonRequest("POST", { action: "Mark as Billable", expected_version: 1 }),
      params(SECURITY_FINDING)
    );

    expect(billable.status).toBe(200);
    const billableJson = await billable.json();

    expect(billableJson.finding.workflow_status).toBe("Decided");
    expect(billableJson.finding.approved_amount_cents).toBeNull();
    expect(billableJson.finding.version).toBe(2);

    const stale = await postActionRoute(
      jsonRequest("POST", { action: "Mark as Invoiced", expected_version: 1 }),
      params(SECURITY_FINDING)
    );

    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({
      finding: { version: 2, approved_amount_cents: null },
    });

    const missingAmount = await postActionRoute(
      jsonRequest("POST", { action: "Mark as Invoiced", expected_version: 2 }),
      params(SECURITY_FINDING)
    );

    expect(missingAmount.status).toBe(400);

    const invoiced = await postActionRoute(
      jsonRequest("POST", {
        action: "Mark as Invoiced",
        expected_version: 2,
        review: {
          approved_hours: 3.5,
          approved_amount_cents: 61234,
          internal_note: "Professional override saved with invoice action."
        }
      }),
      params(SECURITY_FINDING)
    );

    expect(invoiced.status).toBe(200);
    await expect(invoiced.clone().json()).resolves.toMatchObject({
      finding: {
        workflow_status: "Invoiced",
        approved_hours: 3.5,
        approved_amount_cents: 61234,
        version: 3,
      },
    });

    const paid = await postActionRoute(
      jsonRequest("POST", { action: "Mark as Paid", expected_version: 3, note: "Paid by check." }),
      params(SECURITY_FINDING)
    );

    expect(paid.status).toBe(200);
    const paidJson = await paid.json();

    expect(paidJson.finding.workflow_status).toBe("Paid");

    const events = await getFindingEventsRoute(jsonRequest("GET", ""), params(SECURITY_FINDING));
    const eventsJson = await events.json();
    const types = eventsJson.events.map((event: { event_type: string }) => event.event_type);

    expect(types).toContain("Approved Internally");
    expect(types).toContain("Invoiced");
    expect(types).toContain("Paid");
    const invoicedEvent = eventsJson.events.find(
      (event: { event_type: string }) => event.event_type === "Invoiced"
    );

    expect(invoicedEvent.amount_cents).toBe(61234);
  });

  it("keeps rejected findings unbillable until intentionally reopened", async () => {
    const rejected = await postActionRoute(
      jsonRequest("POST", { action: "Reject Finding", expected_version: 1 }),
      params(PRODUCT_TOUR_FINDING)
    );

    expect(rejected.status).toBe(200);

    const paid = await postActionRoute(
      jsonRequest("POST", { action: "Mark as Paid", expected_version: 2 }),
      params(PRODUCT_TOUR_FINDING)
    );

    expect(paid.status).toBe(400);

    const invoiced = await postActionRoute(
      jsonRequest("POST", { action: "Mark as Invoiced", expected_version: 2 }),
      params(PRODUCT_TOUR_FINDING)
    );

    expect(invoiced.status).toBe(400);

    const reopened = await postActionRoute(
      jsonRequest("POST", { action: "Reopen Finding", expected_version: 2 }),
      params(PRODUCT_TOUR_FINDING)
    );

    expect(reopened.status).toBe(200);
    const reopenedJson = await reopened.json();

    expect(reopenedJson.finding.billing_decision).toBe("Undecided");
    expect(reopenedJson.finding.workflow_status).toBe("Needs Review");
  });
});

describe("billing events API", () => {
  it("returns the append-only event log", async () => {
    const response = await getBillingEventsRoute(
      new Request("http://localhost/api/billing-events")
    );

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.events.length).toBeGreaterThanOrEqual(20);
  });

  it("exports a CSV when asked", async () => {
    const response = await getBillingEventsRoute(
      new Request("http://localhost/api/billing-events?format=csv")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    const text = await response.text();

    expect(text.split("\n")[0]).toContain("event_type");
  });
});

describe("report routes", () => {
  it("GET is read-only and never creates a report", async () => {
    await resetLocalDemoStore();

    const before = await readStoreFile();

    expect(before.reports).toHaveLength(0);

    const response = await getReportRoute(jsonRequest("GET", ""), params(DEMO_PROJECT_ID));

    expect(response.status).toBe(404);

    const after = await readStoreFile();

    expect(after.reports).toHaveLength(0);
  });

  it("POST explicitly generates reports and keeps history", async () => {
    const first = await postReportRoute(jsonRequest("POST", ""), params(DEMO_PROJECT_ID));

    expect(first.status).toBe(201);
    const firstJson = await first.json();

    expect(firstJson.report.total_revenue_leakage).toBe(13475);
    expect(firstJson.report.markdown).toContain("Billing Review Status");

    const second = await postReportRoute(jsonRequest("POST", ""), params(DEMO_PROJECT_ID));

    expect(second.status).toBe(201);

    const store = await readStoreFile();

    expect(store.reports).toHaveLength(2);

    const read = await getReportRoute(jsonRequest("GET", ""), params(DEMO_PROJECT_ID));

    expect(read.status).toBe(200);
  });

  it("limits weekly monitoring summaries to Markdown export", async () => {
    const generated = await postReportRoute(
      jsonRequest("POST", { reportType: "Weekly Monitoring Summary" }),
      params(DEMO_PROJECT_ID)
    );

    expect(generated.status).toBe(201);

    const markdown = await getReportRoute(
      new Request(`http://localhost/api/projects/${DEMO_PROJECT_ID}/report?format=markdown`),
      params(DEMO_PROJECT_ID)
    );
    const csv = await getReportRoute(
      new Request(`http://localhost/api/projects/${DEMO_PROJECT_ID}/report?format=csv`),
      params(DEMO_PROJECT_ID)
    );

    expect(markdown.status).toBe(200);
    expect(markdown.headers.get("Content-Type")).toContain("text/markdown");
    expect(csv.status).toBe(400);
  });

  it("returns 404 for a missing project", async () => {
    const missing = await getReportRoute(jsonRequest("GET", ""), params("no-such-project"));

    expect(missing.status).toBe(404);
    const missingPost = await postReportRoute(jsonRequest("POST", ""), params("no-such-project"));

    expect(missingPost.status).toBe(404);
  });
});
