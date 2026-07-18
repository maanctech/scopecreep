import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const createdAt = "2026-06-05T12:00:00.000Z";
const DEMO_USER_ID = "11111111-1111-4111-8111-111111111111";
const DEMO_COMPANY_ID = "11111111-2222-4333-8444-555555555555";
const DEMO_LEAD_ID = "aaaaaaaa-1111-4111-8111-111111111111";
const DEMO_AUDIT_REQUEST_ID = "bbbbbbbb-2222-4222-8222-222222222222";
const DEMO_PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const sowText = `Northstar Digital Studio will redesign and build the public marketing website for ApertureOps, a B2B SaaS company, for a fixed project fee of $48,000.

Included scope:
- Discovery workshop, stakeholder interviews, sitemap, and information architecture for the marketing website.
- Design and Webflow implementation for eight included pages: Home, Platform, Solutions, Pricing, Customers, Resources landing, About, and Contact.
- One reusable blog/article template and one reusable case study template.
- Migration of up to 12 existing approved resource or case study entries supplied by the client.
- Two rounds of design revisions before development and one QA bug-fix pass after staging.
- Basic responsive implementation, standard image compression, form embed placement, and basic metadata for the included pages.
- Light copy editing for clarity and fit using client-provided final copy.

Client responsibilities:
- Client will provide final approved copy, product screenshots, brand assets, legal/privacy text, and form embed code.
- Client will approve the sitemap before visual design and approve page designs before development.

Excluded scope:
- Net-new copywriting, SEO content strategy, new blog articles, comparison pages, or paid ad landing pages.
- Interactive calculators, pricing estimators, product tours requiring custom development, customer login portals, account areas, custom dashboards, or application UI work.
- CRM, marketing automation, enrichment, lifecycle-stage workflows, Slack alerts, or integrations beyond placing the existing form embed code.
- Multi-language localization, translation, video editing, motion design, A/B testing, accessibility audits beyond basic responsive QA, performance optimization beyond standard image compression, weekend rush work, post-launch maintenance, and additional stakeholder presentation decks.

Timeline: 10 weeks from kickoff, assuming client feedback is returned within two business days.`;

const messageRows = [
  [
    "33333333-3333-4333-8333-333333333331",
    "Slack",
    "ApertureOps VP Marketing",
    "Can we update the homepage hero headline and subhead using the final copy from the doc we sent this morning?",
    "2026-05-18"
  ],
  [
    "33333333-3333-4333-8333-333333333332",
    "Asana",
    "ApertureOps Product Marketing",
    "Can you tighten the spacing on the Pricing cards? It feels a little loose on mobile.",
    "2026-05-20"
  ],
  [
    "33333333-3333-4333-8333-333333333333",
    "Email",
    "ApertureOps Customer Marketing",
    "Please add the approved G2 quote and the two existing customer proof points to the Customers page.",
    "2026-05-21"
  ],
  [
    "33333333-3333-4333-8333-333333333334",
    "Slack",
    "ApertureOps CEO",
    "This may be quick: can we add an interactive ROI calculator to the Pricing page so prospects can estimate savings before they book a demo?",
    "2026-05-22"
  ],
  [
    "33333333-3333-4333-8333-333333333335",
    "Email",
    "ApertureOps RevOps",
    "Can the demo request form push leads into HubSpot with lifecycle stage, company size, and a Slack alert to sales?",
    "2026-05-23"
  ],
  [
    "33333333-3333-4333-8333-333333333336",
    "Asana",
    "ApertureOps Content Lead",
    "Can you write three new SEO articles and a 'ApertureOps vs. WorkBoard' comparison page before launch?",
    "2026-05-24"
  ],
  [
    "33333333-3333-4333-8333-333333333337",
    "Slack",
    "ApertureOps EMEA Lead",
    "Our EMEA lead asked whether we can launch a Spanish version of the site at the same time.",
    "2026-05-27"
  ],
  [
    "33333333-3333-4333-8333-333333333338",
    "Zoom",
    "Launch Planning Summary",
    "Can we add a simple customer login area where buyers can access onboarding docs and invoices?",
    "2026-05-28"
  ],
  [
    "33333333-3333-4333-8333-333333333339",
    "Email",
    "ApertureOps VP Sales",
    "Security is becoming a blocker in sales calls. Could we add a Security page, or maybe fit it under Resources if that is easier?",
    "2026-05-29"
  ],
  [
    "33333333-3333-4333-8333-333333333340",
    "Slack",
    "ApertureOps Product Marketing",
    "Can we put the animated product tour from the sales deck on the homepage? I am not sure if that counts as just using an existing asset.",
    "2026-05-30"
  ],
  [
    "33333333-3333-4333-8333-333333333341",
    "Jira",
    "ApertureOps Design Reviewer",
    "Can you swap in the final product screenshots on the Platform page once design is approved?",
    "2026-06-01"
  ],
  [
    "33333333-3333-4333-8333-333333333342",
    "Slack",
    "ApertureOps VP Marketing",
    "Can we change the CTA label from 'Book a demo' to 'See ApertureOps in action' across the included pages?",
    "2026-06-02"
  ]
];

const messages = messageRows.map(([id, source, sender, message_text, message_date]) => ({
  id,
  project_id: DEMO_PROJECT_ID,
  source,
  sender,
  message_text,
  message_date,
  created_at: createdAt
}));

const analyses = [
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
].map((analysis, index) => ({
  id: `44444444-4444-4444-8444-4444444444${String(index + 1).padStart(2, "0")}`,
  client_message_id: messages[index].id,
  created_at: createdAt,
  ...analysis
}));

const salesTemplates = [
  [
    "Cold Email",
    "Free Revenue Leakage Audit",
    "Subject: Quick scope leakage check for {{company}}\n\nHi {{name}},\n\nWe help service firms find unbilled out-of-scope client requests hiding in Slack, email, and project tools. If you have 2-3 recent projects, we can run a free lookback audit and show where revenue may have leaked before it became free work.\n\nWorth a quick look?"
  ],
  [
    "LinkedIn DM",
    "Agency Scope Leakage DM",
    "Noticed you run client delivery at {{company}}. We run scope creep audits for service firms and usually find missed change-order opportunities in day-to-day client requests. Open to a free lookback on one recent project?"
  ],
  [
    "Discovery Call Script",
    "Scope Leakage Discovery",
    "1. What types of client requests most often become free work?\n2. Where do requests live: Slack, email, Jira, Asana, calls?\n3. Who decides when something becomes a change order?\n4. What was the last project where scope expanded but revenue did not?\n5. What hourly or blended rate should we use for leakage estimates?"
  ],
  [
    "Audit Reveal Call Script",
    "Audit Reveal Call",
    "Open with the total estimated leakage, then show 3 specific examples with the client message, SOW evidence, and estimated hours. Ask which findings they agree were out of scope. Close by proposing monthly monitoring to catch these before delivery teams absorb the work."
  ],
  [
    "Proposal Template",
    "Monitoring Proposal",
    "Scope Creep Revenue Monitoring\n\nSetup: $1,500\nMonthly monitoring: $750/month\nOptional performance fee: 10-20% of validated recovered revenue\n\nIncludes weekly request review, monthly leakage report, and change-order draft support."
  ],
  [
    "Follow-up Email",
    "Post Audit Follow-up",
    "Hi {{name}},\n\nAttached is the scope leakage summary we reviewed. The main opportunity is not just recovering past leakage, but preventing these requests from becoming unpaid work in the first place.\n\nRecommended next step: start monthly monitoring on active projects."
  ],
  [
    "Objection Handling",
    "Common Objections",
    "We do not want to nickel-and-dime clients: The goal is not aggressive billing. It is evidence-based scope clarity before teams absorb unpaid work.\n\nOur PMs already catch this: Great. This gives them audit evidence and client-ready language.\n\nWe need integrations first: For the pilot, pasted exports are enough to prove the leakage model."
  ]
].map(([template_type, title, body], index) => ({
  id: `55555555-000${index + 1}-4000-8000-00000000000${index + 1}`,
  template_type,
  title,
  body,
  created_at: createdAt,
  updated_at: createdAt
}));

const store = {
  users: [
    {
      id: DEMO_USER_ID,
      email: "founder@scopeaudit.test",
      company_name: "Scope Creep Revenue Recovery",
      created_at: createdAt
    }
  ],
  companies: [
    {
      id: DEMO_COMPANY_ID,
      name: "Northstar Digital Studio",
      website: "https://northstardigital.studio",
      business_type: "Agency",
      team_size: "11-25",
      created_at: createdAt
    }
  ],
  leads: [
    {
      id: DEMO_LEAD_ID,
      company_id: DEMO_COMPANY_ID,
      name: "Maya Chen",
      email: "maya@northstardigital.studio",
      company: "Northstar Digital Studio",
      website: "https://northstardigital.studio",
      business_type: "Agency",
      team_size: "11-25",
      average_project_value: 48000,
      hourly_rate: 175,
      pain_point:
        "Senior clients add small-sounding website requests during delivery, and PMs struggle to decide what needs a change order before the team starts building.",
      consent_to_contact: true,
      status: "Audit Running",
      created_at: createdAt
    }
  ],
  leadStatusHistory: [
    {
      id: "99999999-1111-4111-8111-111111111111",
      lead_id: DEMO_LEAD_ID,
      from_status: null,
      to_status: "New",
      note: "Seed lead created.",
      created_at: createdAt
    },
    {
      id: "99999999-2222-4222-8222-222222222222",
      lead_id: DEMO_LEAD_ID,
      from_status: "New",
      to_status: "Audit Running",
      note: "Demo audit in progress.",
      created_at: createdAt
    }
  ],
  auditRequests: [
    {
      id: DEMO_AUDIT_REQUEST_ID,
      lead_id: DEMO_LEAD_ID,
      company_id: DEMO_COMPANY_ID,
      client_name: "ApertureOps",
      project_value: 48000,
      hourly_rate: 175,
      sow_text: sowText,
      message_export_text: messages.map((message) => message.message_text).join("\n"),
      suspected_scope_creep_notes:
        "The ROI calculator, HubSpot workflow, SEO content, localization, and login area were all requested casually after the fixed-fee SOW was approved.",
      status: "Analyzed",
      created_at: createdAt
    }
  ],
  projects: [
    {
      id: DEMO_PROJECT_ID,
      company_id: DEMO_COMPANY_ID,
      lead_id: DEMO_LEAD_ID,
      audit_request_id: DEMO_AUDIT_REQUEST_ID,
      client_name: "ApertureOps",
      project_name: "$48,000 B2B SaaS Website Redesign",
      hourly_rate: 175,
      project_value: 48000,
      sow_text: sowText,
      created_at: createdAt
    }
  ],
  clientMessages: messages,
  scopeAnalyses: analyses,
  reports: [
    {
      id: "77777777-7777-4777-8777-777777777777",
      project_id: DEMO_PROJECT_ID,
      title: "ApertureOps Scope Creep Audit",
      markdown: "",
      total_revenue_leakage: 13475,
      analyzed_messages_count: 12,
      out_of_scope_count: 5,
      created_at: createdAt
    }
  ],
  salesTemplates
};

const dataDir = path.join(process.cwd(), "data");
await mkdir(dataDir, { recursive: true });
await writeFile(path.join(dataDir, "demo-store.json"), JSON.stringify(store, null, 2));
console.log("Local business demo data reset in data/demo-store.json");
