import type { ClientMessage } from "@/lib/types";
import { DEMO_PROJECT_ID, createdAt } from "@/lib/demo/constants";

export const messageExportText = [
  "Can we update the homepage hero headline and subhead using the final copy from the doc we sent this morning?",
  "Can you tighten the spacing on the Pricing cards? It feels a little loose on mobile.",
  "Please add the approved G2 quote and the two existing customer proof points to the Customers page.",
  "This may be quick: can we add an interactive ROI calculator to the Pricing page so prospects can estimate savings before they book a demo?",
  "Can the demo request form push leads into HubSpot with lifecycle stage, company size, and a Slack alert to sales?",
  "Can you write three new SEO articles and a 'ApertureOps vs. WorkBoard' comparison page before launch?",
  "Our EMEA lead asked whether we can launch a Spanish version of the site at the same time.",
  "Can we add a simple customer login area where buyers can access onboarding docs and invoices?",
  "Security is becoming a blocker in sales calls. Could we add a Security page, or maybe fit it under Resources if that is easier?",
  "Can we put the animated product tour from the sales deck on the homepage? I am not sure if that counts as just using an existing asset.",
  "Can you swap in the final product screenshots on the Platform page once design is approved?",
  "Can we change the CTA label from 'Book a demo' to 'See ApertureOps in action' across the included pages?"
].join("\n");

const demoMessageRows: Array<Omit<ClientMessage, "id" | "project_id" | "created_at"> & { id: string }> = [
  {
    id: "33333333-3333-4333-8333-333333333331",
    source: "Slack",
    sender: "ApertureOps VP Marketing",
    message_text:
      "Can we update the homepage hero headline and subhead using the final copy from the doc we sent this morning?",
    message_date: "2026-05-18"
  },
  {
    id: "33333333-3333-4333-8333-333333333332",
    source: "Asana",
    sender: "ApertureOps Product Marketing",
    message_text: "Can you tighten the spacing on the Pricing cards? It feels a little loose on mobile.",
    message_date: "2026-05-20"
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    source: "Email",
    sender: "ApertureOps Customer Marketing",
    message_text:
      "Please add the approved G2 quote and the two existing customer proof points to the Customers page.",
    message_date: "2026-05-21"
  },
  {
    id: "33333333-3333-4333-8333-333333333334",
    source: "Slack",
    sender: "ApertureOps CEO",
    message_text:
      "This may be quick: can we add an interactive ROI calculator to the Pricing page so prospects can estimate savings before they book a demo?",
    message_date: "2026-05-22"
  },
  {
    id: "33333333-3333-4333-8333-333333333335",
    source: "Email",
    sender: "ApertureOps RevOps",
    message_text:
      "Can the demo request form push leads into HubSpot with lifecycle stage, company size, and a Slack alert to sales?",
    message_date: "2026-05-23"
  },
  {
    id: "33333333-3333-4333-8333-333333333336",
    source: "Asana",
    sender: "ApertureOps Content Lead",
    message_text:
      "Can you write three new SEO articles and a 'ApertureOps vs. WorkBoard' comparison page before launch?",
    message_date: "2026-05-24"
  },
  {
    id: "33333333-3333-4333-8333-333333333337",
    source: "Slack",
    sender: "ApertureOps EMEA Lead",
    message_text: "Our EMEA lead asked whether we can launch a Spanish version of the site at the same time.",
    message_date: "2026-05-27"
  },
  {
    id: "33333333-3333-4333-8333-333333333338",
    source: "Zoom",
    sender: "Launch Planning Summary",
    message_text:
      "Can we add a simple customer login area where buyers can access onboarding docs and invoices?",
    message_date: "2026-05-28"
  },
  {
    id: "33333333-3333-4333-8333-333333333339",
    source: "Email",
    sender: "ApertureOps VP Sales",
    message_text:
      "Security is becoming a blocker in sales calls. Could we add a Security page, or maybe fit it under Resources if that is easier?",
    message_date: "2026-05-29"
  },
  {
    id: "33333333-3333-4333-8333-333333333340",
    source: "Slack",
    sender: "ApertureOps Product Marketing",
    message_text:
      "Can we put the animated product tour from the sales deck on the homepage? I am not sure if that counts as just using an existing asset.",
    message_date: "2026-05-30"
  },
  {
    id: "33333333-3333-4333-8333-333333333341",
    source: "Jira",
    sender: "ApertureOps Design Reviewer",
    message_text: "Can you swap in the final product screenshots on the Platform page once design is approved?",
    message_date: "2026-06-01"
  },
  {
    id: "33333333-3333-4333-8333-333333333342",
    source: "Slack",
    sender: "ApertureOps VP Marketing",
    message_text:
      "Can we change the CTA label from 'Book a demo' to 'See ApertureOps in action' across the included pages?",
    message_date: "2026-06-02"
  }
];

export const demoMessages: ClientMessage[] = demoMessageRows.map((message) => ({
  ...message,
  project_id: DEMO_PROJECT_ID,
  created_at: createdAt
}));
