import type { AnalysisInput, BillingDecision, ScopeFinding, WorkflowStatus } from "@/lib/types";
import { DEMO_PROJECT_ID, createdAt } from "@/lib/demo/constants";
import { demoMessages } from "@/lib/demo/messages";

const analysisByMessageId: Record<string, AnalysisInput> = {
  "33333333-3333-4333-8333-333333333331": {
    classification: "In Scope",
    confidence_score: 0.9,
    reasoning:
      "The Home page is included and the client is supplying final approved copy. Updating headline and subhead copy fits light copy editing and included page implementation.",
    relevant_sow_sections: [
      "Eight included pages include Home.",
      "Light copy editing for clarity and fit using client-provided final copy."
    ],
    request_type: "Revision",
    estimated_hours: 0,
    estimated_revenue: 0,
    suggested_change_order:
      "This looks covered by the current website scope because it uses client-provided final copy for an included page. We will include it in the current revision pass.",
    internal_note: "Verify the design revision round is still open."
  },
  "33333333-3333-4333-8333-333333333332": {
    classification: "In Scope",
    confidence_score: 0.86,
    reasoning:
      "Pricing is an included page and spacing adjustments are design revisions. The SOW includes two rounds of design revisions before development.",
    relevant_sow_sections: [
      "Eight included pages include Pricing.",
      "Two rounds of design revisions before development."
    ],
    request_type: "Design",
    estimated_hours: 0,
    estimated_revenue: 0,
    suggested_change_order:
      "This appears covered as a design revision to an included page. We will include it in the active revision round.",
    internal_note: "If both design revision rounds have been used, review before approving."
  },
  "33333333-3333-4333-8333-333333333333": {
    classification: "In Scope",
    confidence_score: 0.84,
    reasoning:
      "The Customers page is included, and the request uses approved existing customer proof points rather than net-new writing.",
    relevant_sow_sections: [
      "Eight included pages include Customers.",
      "Migration of up to 12 existing approved resource or case study entries supplied by the client."
    ],
    request_type: "Admin",
    estimated_hours: 0,
    estimated_revenue: 0,
    suggested_change_order:
      "This appears covered as placement of approved customer proof on an included page. We will add it to the Customers page during implementation.",
    internal_note: "Confirm the proof points are client-approved and within the existing content allowance."
  },
  "33333333-3333-4333-8333-333333333334": {
    classification: "Out of Scope",
    confidence_score: 0.98,
    reasoning:
      "The SOW explicitly excludes interactive calculators and pricing estimators. Although the request sounds small, it requires custom UX, calculation logic, validation, QA, and likely stakeholder review.",
    relevant_sow_sections: ["Excluded scope includes interactive calculators and pricing estimators."],
    request_type: "Engineering",
    estimated_hours: 28,
    estimated_revenue: 4900,
    suggested_change_order:
      "We can add an interactive ROI calculator as a separate scope item. It is outside the current website redesign SOW because interactive calculators and pricing estimators are excluded. We estimate 28 additional hours, or $4,900, to define the inputs, design the interaction, build it, and QA it. Please confirm if you would like a formal change order.",
    internal_note: "Small-sounding request with meaningful build and QA cost. Strong audit example."
  },
  "33333333-3333-4333-8333-333333333335": {
    classification: "Out of Scope",
    confidence_score: 0.94,
    reasoning:
      "The SOW includes form embed placement but excludes CRM, marketing automation, lifecycle workflows, Slack alerts, and integrations beyond placing existing form embed code.",
    relevant_sow_sections: [
      "Included scope covers form embed placement.",
      "Excluded scope includes CRM, marketing automation, lifecycle-stage workflows, Slack alerts, or integrations beyond placing existing form embed code."
    ],
    request_type: "Engineering",
    estimated_hours: 10,
    estimated_revenue: 1750,
    suggested_change_order:
      "We can support the HubSpot routing and Slack alert workflow as an additional integration scope. The current SOW only includes placement of the existing form embed code, so this would require a change order. We estimate 10 additional hours, or $1,750, pending access to HubSpot and Slack configuration.",
    internal_note: "Good example of a form request expanding into RevOps implementation."
  },
  "33333333-3333-4333-8333-333333333336": {
    classification: "Out of Scope",
    confidence_score: 0.97,
    reasoning:
      "The SOW excludes net-new copywriting, SEO content strategy, new blog articles, and comparison pages. This asks for new content deliverables before launch.",
    relevant_sow_sections: [
      "Excluded scope includes net-new copywriting, SEO content strategy, new blog articles, and comparison pages."
    ],
    request_type: "New Deliverable",
    estimated_hours: 12,
    estimated_revenue: 2100,
    suggested_change_order:
      "We can add the SEO articles and comparison page as a separate content scope. New articles and comparison pages are outside the current SOW, so we estimate 12 additional hours, or $2,100, for outlining, drafting coordination, page setup, and review support.",
    internal_note: "Estimate assumes client supplies subject matter input and final approvals."
  },
  "33333333-3333-4333-8333-333333333337": {
    classification: "Out of Scope",
    confidence_score: 0.93,
    reasoning:
      "The SOW explicitly excludes multi-language localization and translation. A Spanish version of the site is a separate localization effort.",
    relevant_sow_sections: ["Excluded scope includes multi-language localization and translation."],
    request_type: "Other",
    estimated_hours: 8,
    estimated_revenue: 1400,
    suggested_change_order:
      "A Spanish version can be added, but localization is outside the current SOW. We estimate 8 additional hours, or $1,400, for page duplication, localized content placement, QA, and launch checks, assuming translations are client-provided.",
    internal_note: "Confirm whether translation is provided by the client; otherwise estimate should increase."
  },
  "33333333-3333-4333-8333-333333333338": {
    classification: "Out of Scope",
    confidence_score: 0.95,
    reasoning:
      "The SOW excludes customer login portals, account areas, custom dashboards, and application UI work. A customer login area with onboarding docs and invoices is outside the marketing site scope.",
    relevant_sow_sections: [
      "Excluded scope includes customer login portals, account areas, custom dashboards, or application UI work."
    ],
    request_type: "Engineering",
    estimated_hours: 12,
    estimated_revenue: 2100,
    suggested_change_order:
      "A customer login area is outside the current marketing website SOW because it introduces account-area functionality and application-style UI. We estimate an initial 12 additional hours, or $2,100, for discovery and a lightweight implementation plan; a final build estimate would follow technical scoping.",
    internal_note: "Potentially much larger than 12 hours; estimate here is discovery plus lightweight planning."
  },
  "33333333-3333-4333-8333-333333333339": {
    classification: "Needs Human Review",
    confidence_score: 0.58,
    reasoning:
      "The SOW includes a Resources landing page but only names eight included pages. It is unclear whether a Security page would replace an included page, become a new page, or be a small section inside Resources.",
    relevant_sow_sections: [
      "Included pages are Home, Platform, Solutions, Pricing, Customers, Resources landing, About, and Contact.",
      "The SOW includes one reusable blog/article template and one reusable case study template."
    ],
    request_type: "Strategy",
    estimated_hours: 3,
    estimated_revenue: 525,
    suggested_change_order:
      "Security content may be handled in a few different ways. Could you confirm whether this should be a new standalone page, a section within the Resources landing page, or a replacement for one of the included pages? Once confirmed, we can determine whether it fits the current scope or needs a change order.",
    internal_note: "Ask for placement and content ownership before classifying."
  },
  "33333333-3333-4333-8333-333333333340": {
    classification: "Needs Human Review",
    confidence_score: 0.52,
    reasoning:
      "The SOW excludes product tours requiring custom development, video editing, and motion design. The message says the asset may already exist, so the scope depends on whether this is a simple embed or new implementation work.",
    relevant_sow_sections: [
      "Excluded scope includes product tours requiring custom development.",
      "Excluded scope includes video editing and motion design."
    ],
    request_type: "Design",
    estimated_hours: 4,
    estimated_revenue: 700,
    suggested_change_order:
      "We can review the product tour asset and confirm the implementation path. If it is a simple approved embed or static asset, it may fit within the page build. If it requires custom animation, editing, or product-tour development, we should treat it as a change order.",
    internal_note: "Needs asset review before billing decision."
  },
  "33333333-3333-4333-8333-333333333341": {
    classification: "In Scope",
    confidence_score: 0.88,
    reasoning:
      "The Platform page is included, and the client is providing product screenshots as part of its responsibilities. Swapping final screenshots is covered implementation work.",
    relevant_sow_sections: [
      "Eight included pages include Platform.",
      "Client will provide final approved copy, product screenshots, brand assets, legal/privacy text, and form embed code."
    ],
    request_type: "Admin",
    estimated_hours: 0,
    estimated_revenue: 0,
    suggested_change_order:
      "This appears covered. Once the final approved screenshots are provided, we will swap them into the Platform page as part of implementation.",
    internal_note: "Confirm screenshots are final and approved."
  },
  "33333333-3333-4333-8333-333333333342": {
    classification: "Possibly In Scope",
    confidence_score: 0.72,
    reasoning:
      "CTA copy updates across included pages may fit light copy editing and included page implementation if the request remains limited to included pages and revision rounds are still available.",
    relevant_sow_sections: [
      "Light copy editing for clarity and fit using client-provided final copy.",
      "Two rounds of design revisions before development."
    ],
    request_type: "Revision",
    estimated_hours: 0,
    estimated_revenue: 0,
    suggested_change_order:
      "This likely fits within the current scope if the CTA update is limited to included pages and the active revision round. We will confirm it against the revision log before treating it as included.",
    internal_note: "Check whether this affects only included pages and whether revision rounds remain."
  }
};

export const demoReviewedAt = "2026-06-06T10:00:00.000Z";

type DemoWorkflowSeed = {
  billing_decision: BillingDecision;
  workflow_status: WorkflowStatus;
  approved_hours: number | null;
  approved_amount_cents: number | null;
};

const workflowSeedByMessageId: Record<string, DemoWorkflowSeed> = {
  "33333333-3333-4333-8333-333333333334": {
    billing_decision: "Bill Separately",
    workflow_status: "Invoiced",
    approved_hours: 28,
    approved_amount_cents: 490000
  },
  "33333333-3333-4333-8333-333333333335": {
    billing_decision: "Bill Separately",
    workflow_status: "Decided",
    approved_hours: 10,
    approved_amount_cents: 175000
  },
  "33333333-3333-4333-8333-333333333336": {
    billing_decision: "Discuss With Client",
    workflow_status: "Discussing",
    approved_hours: null,
    approved_amount_cents: null
  },
  "33333333-3333-4333-8333-333333333337": {
    billing_decision: "Absorb Courtesy",
    workflow_status: "Closed",
    approved_hours: null,
    approved_amount_cents: null
  },
  "33333333-3333-4333-8333-333333333338": {
    billing_decision: "Bill Separately",
    workflow_status: "Paid",
    approved_hours: 12,
    approved_amount_cents: 210000
  }
};

export const demoFindings: ScopeFinding[] = demoMessages.map((message, index) => {
  const analysis = analysisByMessageId[message.id];
  const seed = workflowSeedByMessageId[message.id];
  const reviewed = Boolean(seed);

  return {
    id: `44444444-4444-4444-8444-4444444444${String(index + 1).padStart(2, "0")}`,
    project_id: DEMO_PROJECT_ID,
    client_message_id: message.id,
    ...analysis,
    billing_decision: seed?.billing_decision ?? "Undecided",
    workflow_status:
      seed?.workflow_status ?? (analysis.classification === "In Scope" ? "New" : "Needs Review"),
    approved_hours: seed?.approved_hours ?? null,
    approved_amount_cents: seed?.approved_amount_cents ?? null,
    client_facing_explanation: analysis.suggested_change_order,
    reviewed_by: reviewed ? "Professional" : null,
    reviewed_at: reviewed ? demoReviewedAt : null,
    created_at: createdAt,
    updated_at: reviewed ? demoReviewedAt : createdAt,
    version: 1,
    is_demo: true
  };
});

export const demoFindingByMessageId = new Map(
  demoFindings.map((finding) => [finding.client_message_id, finding])
);
