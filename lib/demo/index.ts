import { demoAuditRequest, demoCompany, demoLead, demoLeadStatusHistory, demoProject, demoUser } from "@/lib/demo/entities";
import { demoMessages } from "@/lib/demo/messages";
import { demoFindings } from "@/lib/demo/findings";
import { demoBillingEvents } from "@/lib/demo/billingEvents";
import { demoSalesTemplates } from "@/lib/demo/salesTemplates";

export { DEMO_PROJECT_ID } from "@/lib/demo/constants";
export { demoFindings } from "@/lib/demo/findings";

export function buildDemoStore() {
  return {
    schema_version: 2,
    users: [demoUser],
    companies: [demoCompany],
    leads: [demoLead],
    leadStatusHistory: demoLeadStatusHistory,
    auditRequests: [demoAuditRequest],
    projects: [demoProject],
    clientMessages: demoMessages,
    scopeFindings: demoFindings,
    billingEvents: demoBillingEvents,
    // No report is seeded: reports are generated only through the explicit
    // "Generate report" action, never as a side effect of reading a page.
    reports: [],
    salesTemplates: demoSalesTemplates
  };
}
