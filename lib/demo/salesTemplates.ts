import type { SalesTemplate } from "@/lib/types";
import { createdAt } from "@/lib/demo/constants";

export const demoSalesTemplates: SalesTemplate[] = [
  {
    id: "55555555-0001-4000-8000-000000000001",
    template_type: "Cold Email",
    title: "Free Revenue Leakage Audit",
    body:
      "Subject: Quick scope leakage check for {{company}}\n\nHi {{name}},\n\nWe help service firms find unbilled out-of-scope client requests hiding in Slack, email, and project tools. If you have 2-3 recent projects, we can run a free lookback audit and show where revenue may have leaked before it became free work.\n\nWorth a quick look?",
    created_at: createdAt,
    updated_at: createdAt
  },
  {
    id: "55555555-0002-4000-8000-000000000002",
    template_type: "LinkedIn DM",
    title: "Agency Scope Leakage DM",
    body:
      "Noticed you run client delivery at {{company}}. We run scope creep audits for service firms and usually find missed change-order opportunities in day-to-day client requests. Open to a free lookback on one recent project?",
    created_at: createdAt,
    updated_at: createdAt
  },
  {
    id: "55555555-0003-4000-8000-000000000003",
    template_type: "Discovery Call Script",
    title: "Scope Leakage Discovery",
    body:
      "1. What types of client requests most often become free work?\n2. Where do requests live: Slack, email, Jira, Asana, calls?\n3. Who decides when something becomes a change order?\n4. What was the last project where scope expanded but revenue did not?\n5. What hourly or blended rate should we use for leakage estimates?",
    created_at: createdAt,
    updated_at: createdAt
  },
  {
    id: "55555555-0004-4000-8000-000000000004",
    template_type: "Audit Reveal Call Script",
    title: "Audit Reveal Call",
    body:
      "Open with the total estimated leakage, then show 3 specific examples with the client message, SOW evidence, and estimated hours. Ask which findings they agree were out of scope. Close by proposing monthly monitoring to catch these before delivery teams absorb the work.",
    created_at: createdAt,
    updated_at: createdAt
  },
  {
    id: "55555555-0005-4000-8000-000000000005",
    template_type: "Proposal Template",
    title: "Monitoring Proposal",
    body:
      "Scope Creep Revenue Monitoring\n\nSetup: $1,500\nMonthly monitoring: $750/month\nOptional performance fee: 10-20% of validated recovered revenue\n\nIncludes weekly request review, monthly leakage report, and change-order draft support.",
    created_at: createdAt,
    updated_at: createdAt
  },
  {
    id: "55555555-0006-4000-8000-000000000006",
    template_type: "Follow-up Email",
    title: "Post Audit Follow-up",
    body:
      "Hi {{name}},\n\nAttached is the scope leakage summary we reviewed. The main opportunity is not just recovering past leakage, but preventing these requests from becoming unpaid work in the first place.\n\nRecommended next step: start monthly monitoring on active projects.",
    created_at: createdAt,
    updated_at: createdAt
  },
  {
    id: "55555555-0007-4000-8000-000000000007",
    template_type: "Objection Handling",
    title: "Common Objections",
    body:
      "We do not want to nickel-and-dime clients: The goal is not aggressive billing. It is evidence-based scope clarity before teams absorb unpaid work.\n\nOur PMs already catch this: Great. This gives them audit evidence and client-ready language.\n\nWe need integrations first: For the pilot, pasted exports are enough to prove the leakage model.",
    created_at: createdAt,
    updated_at: createdAt
  }
];
