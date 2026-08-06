import { formatCents, formatDollars } from "@/lib/domain/money";
import { computeRevenueTotals } from "@/lib/domain/revenueTotals";
import type { MessageWithFinding, Project, ReportType, ScopeFinding } from "@/lib/types";

type ReportInput = {
  reportType: ReportType;
  project: Project;
  rows: MessageWithFinding[];
  generatedAt?: Date;
  monitoring?: MonitoringHealth | null;
};

export type MonitoringHealth = {
  automation: {
    status: string;
    lastSucceededAt: string | null;
    nextRunAt: string | null;
    lastError: string | null;
  } | null;
  connectors: Array<{
    provider: string;
    status: string;
    lastSyncedAt: string | null;
    lastError: string | null;
  }>;
};

function markdownText(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([\\`*_[\]{}()#+|])/g, "\\$1")
    .replace(/^(\s*)-/gm, "$1\\-");
}

function findings(rows: MessageWithFinding[]) {
  return rows.filter(
    (row): row is MessageWithFinding & { finding: ScopeFinding } => Boolean(row.finding)
  );
}

function potential(finding: ScopeFinding) {
  return finding.classification === "In Scope" ? 0 : finding.estimated_revenue;
}

function evidence(finding: ScopeFinding) {
  return finding.relevant_sow_sections.length
    ? finding.relevant_sow_sections.map((item) => `  - ${markdownText(item)}`).join("\n")
    : "  - No specific SOW evidence was returned; human review is required.";
}

function opportunity(row: MessageWithFinding & { finding: ScopeFinding }, index: number) {
  const finding = row.finding;

  return `### ${index + 1}. ${finding.classification}: ${markdownText(row.message.message_text)}

- Request type: ${finding.request_type}
- Estimated hours: ${finding.estimated_hours}
- Potential revenue: ${formatDollars(potential(finding))}
- Billing decision: ${finding.billing_decision}
- Workflow status: ${finding.workflow_status}
- Reasoning: ${markdownText(finding.reasoning)}
- SOW evidence:
${evidence(finding)}
- Client-facing draft (not sent):
${markdownText(finding.client_facing_explanation)}`;
}

function reportHeader(input: ReportInput, draft = false) {
  return `# ${input.reportType}

${draft ? "**DRAFT - Professional review required before client use.**\n\n" : ""}Client: ${markdownText(input.project.client_name)}
Project: ${markdownText(input.project.project_name)}
Hourly rate: ${formatDollars(input.project.hourly_rate)}/hour`;
}

export function generateReportDocument(input: ReportInput) {
  const analyzed = findings(input.rows);
  const flagged = analyzed
    .filter((row) => row.finding.classification !== "In Scope")
    .sort((a, b) => potential(b.finding) - potential(a.finding));
  const total = flagged.reduce((sum, row) => sum + potential(row.finding), 0);
  const outOfScope = analyzed.filter((row) => row.finding.classification === "Out of Scope").length;
  const totals = computeRevenueTotals(analyzed.map((row) => row.finding));
  const top = flagged.slice(0, 5).map(opportunity).join("\n\n");
  const footer = "ScopeLedger never sends reports, change orders, messages, or invoices automatically.";

  if (input.reportType === "Finding Summary") {
    const items = analyzed
      .map(
        (row, index) =>
          `${index + 1}. **${row.finding.classification}** - ${markdownText(row.message.message_text)} (${formatDollars(potential(row.finding))}; ${row.finding.workflow_status})`
      )
      .join("\n");

    return `${reportHeader(input)}

## Summary

- Messages analyzed: ${analyzed.length}
- Out-of-scope requests: ${outOfScope}
- Potential revenue leakage: ${formatDollars(total)}

## Findings

${items || "No findings have been generated."}

${footer}`;
  }

  if (input.reportType === "Revenue Leakage Report") {
    return `${reportHeader(input)}

## Revenue Position

- Potential leakage (AI estimate): ${formatDollars(total)}
- Needs review: ${formatDollars(totals.needs_review_dollars)}
- Approved for billing: ${formatCents(totals.billable_cents)}
- Discussing with client: ${formatDollars(totals.discussing_dollars)}
- Invoiced: ${formatCents(totals.invoiced_cents)}
- Paid: ${formatCents(totals.paid_cents)}
- Included in retainer: ${formatCents(totals.retainer_cents)}
- Absorbed as courtesy: ${formatDollars(totals.absorbed_dollars)}
- Rejected: ${formatDollars(totals.rejected_dollars)}

## Largest Opportunities

${top || "No potential leakage was identified."}

${footer}`;
  }

  if (input.reportType === "Client Discussion Brief") {
    const discussionItems = flagged
      .map(
        (row, index) => `### ${index + 1}. ${markdownText(row.message.message_text)}

**Agreement evidence**
${evidence(row.finding)}

**Draft language - not sent**
${markdownText(row.finding.client_facing_explanation)}`
      )
      .join("\n\n");

    return `${reportHeader(input, true)}

## Purpose

Use this internal brief to prepare for a client scope discussion. Confirm every item, amount, and contract reference before the call.

## Discussion Items

${discussionItems || "No flagged requests are available for discussion."}

${footer}`;
  }

  if (input.reportType === "Change Order Draft") {
    const approvedRows = analyzed.filter(
      (row) =>
        row.finding.billing_decision === "Bill Separately" &&
        row.finding.approved_amount_cents !== null &&
        ["Decided", "Invoiced", "Paid"].includes(row.finding.workflow_status)
    );
    const approvedDrafts = approvedRows
      .map(
        (row, index) => `## Draft ${index + 1}: ${row.finding.request_type}

Requested work: ${markdownText(row.message.message_text)}

Professional-approved effort: ${row.finding.approved_hours ?? "Not specified"} hours
Professional-approved amount: ${formatCents(row.finding.approved_amount_cents!)}

SOW evidence:
${evidence(row.finding)}

Client-facing draft - not sent:
Thanks for the additional request regarding ${markdownText(row.message.message_text)}. Based on the agreed scope evidence above, this is additional work. We can proceed through a change order for ${row.finding.approved_hours === null ? "the professionally reviewed effort" : `${row.finding.approved_hours} hours`} at a professional-approved amount of ${formatCents(row.finding.approved_amount_cents!)}. Please confirm that you would like us to proceed.`
      )
      .join("\n\n");
    const discussionDrafts = analyzed
      .filter((row) => row.finding.billing_decision === "Discuss With Client")
      .map(
        (row, index) => `## Unapproved discussion draft ${index + 1}: ${row.finding.request_type}

**UNAPPROVED - No price or effort is authorized for client use.**

Requested work: ${markdownText(row.message.message_text)}

SOW evidence:
${evidence(row.finding)}

Discussion language - not sent:
${markdownText(row.finding.client_facing_explanation)}`
      )
      .join("\n\n");

    return `${reportHeader(input, true)}

## Professionally Approved Change-Order Items

${approvedDrafts || "No findings have a professional-approved amount for a change-order draft."}

## Unapproved Discussion Drafts

${discussionDrafts || "No findings are currently under client discussion."}

${footer}`;
  }

  if (input.reportType === "Invoice Support Summary") {
    const invoiceRows = analyzed.filter(
      (row) =>
        row.finding.billing_decision === "Bill Separately" &&
        row.finding.approved_amount_cents !== null &&
        ["Decided", "Invoiced", "Paid"].includes(row.finding.workflow_status)
    );
    const items = invoiceRows
      .map(
        (row, index) => `${index + 1}. ${markdownText(row.message.message_text)}
   - Approved hours: ${row.finding.approved_hours ?? "Not set"}
   - Approved amount: ${formatCents(row.finding.approved_amount_cents!)}
   - Status: ${row.finding.workflow_status}
   - Evidence: ${row.finding.relevant_sow_sections.map(markdownText).join("; ") || "Human verification required"}`
      )
      .join("\n");
    const approved = invoiceRows.reduce(
      (sum, row) => sum + row.finding.approved_amount_cents!,
      0
    );

    return `${reportHeader(input)}

## Approved Separately Billable Work

${items || "No findings are currently approved as separately billable."}

Total approved amount represented: ${formatCents(approved)}

This summary supports manual invoicing only. Verify invoice details in the billing system of record.

${footer}`;
  }

  if (input.reportType === "Weekly Monitoring Summary") {
    const generatedAt = input.generatedAt ?? new Date();
    const periodStart = new Date(generatedAt.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentRows = input.rows.filter((row) => {
      const timestamp = Date.parse(row.message.created_at);

      return Number.isFinite(timestamp) && timestamp >= periodStart.getTime() && timestamp <= generatedAt.getTime();
    });
    const recentFindings = analyzed.filter((row) => {
      const timestamp = Date.parse(row.finding.created_at);

      return Number.isFinite(timestamp) && timestamp >= periodStart.getTime() && timestamp <= generatedAt.getTime();
    });
    const recentPotential = recentFindings.reduce(
      (sum, row) => sum + potential(row.finding),
      0
    );
    const automation = input.monitoring?.automation;
    const connectorLines = input.monitoring?.connectors.map(
      (connector) =>
        `- ${markdownText(connector.provider)}: ${markdownText(connector.status)}; last successful sync: ${connector.lastSyncedAt ? markdownText(connector.lastSyncedAt) : "Never"}${connector.lastError ? `; attention: ${markdownText(connector.lastError)}` : ""}`
    ).join("\n");

    return `${reportHeader(input)}

Reporting period: ${periodStart.toISOString()} through ${generatedAt.toISOString()}

## Weekly Activity

- New messages: ${recentRows.length}
- New findings: ${recentFindings.length}
- Potential leakage identified this period (AI estimate): ${formatDollars(recentPotential)}
- Findings currently awaiting professional review: ${totals.needs_review_count}

## Current Revenue Position

Potential leakage (AI estimate, not approved): ${formatDollars(totals.potential_dollars)}

The following professional-controlled buckets are mutually exclusive:

- Approved for billing, not invoiced: ${formatCents(totals.billable_cents)}
- Invoiced, not paid: ${formatCents(totals.invoiced_cents)}
- Paid: ${formatCents(totals.paid_cents)}
- Included in retainer: ${formatCents(totals.retainer_cents)}

## Monitoring Health

- Automation: ${automation ? markdownText(automation.status) : "Not configured"}
- Last successful run: ${automation?.lastSucceededAt ? markdownText(automation.lastSucceededAt) : "Never"}
- Next scheduled run: ${automation?.nextRunAt ? markdownText(automation.nextRunAt) : "Not scheduled"}
${automation?.lastError ? `- Automation attention: ${markdownText(automation.lastError)}` : ""}

### Communication Sources

${connectorLines || "No communication sources are configured for this project."}

This report is an internal monitoring summary. Potential values are AI estimates; only professional-approved amounts may support billing.

${footer}`;
  }

  return `${reportHeader(input)}

## Executive Summary

This audit reviewed ${analyzed.length} client message${analyzed.length === 1 ? "" : "s"} against the approved Statement of Work and identified ${outOfScope} out-of-scope request${outOfScope === 1 ? "" : "s"}. Potential revenue leakage is estimated at ${formatDollars(total)}. Every finding requires professional approval before billing.

## Billing Review Status

- Needs review: ${formatDollars(totals.needs_review_dollars)}
- Approved for billing: ${formatCents(totals.billable_cents)}
- Discussing with client: ${formatDollars(totals.discussing_dollars)}
- Invoiced: ${formatCents(totals.invoiced_cents)}
- Paid: ${formatCents(totals.paid_cents)}

## Top Missed Billing Opportunities

${top || "No missed billing opportunities were found."}

## Recommended Next Steps

1. Validate each flagged request with the project manager.
2. Confirm effort and price before client discussion.
3. Use client-facing drafts only after professional approval.
4. Review new client requests weekly during active delivery.

## Suggested Monthly Monitoring Plan

Run a weekly scope review and a monthly leakage summary by project. Keep potential, approved, invoiced, and paid values separate.

${footer}`;
}

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);

  if (/^[=+\-@]/.test(text)) text = `'${text}`;

  return `"${text.replace(/"/g, '""')}"`;
}

export function generateFindingsCsv(project: Project, rows: MessageWithFinding[]) {
  const header = [
    "Project",
    "Client",
    "Message date",
    "Source",
    "Client request",
    "Classification",
    "Request type",
    "Confidence",
    "Estimated hours",
    "Potential revenue",
    "Billing decision",
    "Workflow status",
    "Approved hours",
    "Approved amount",
    "SOW evidence"
  ];
  const body = findings(rows).map((row) => [
    project.project_name,
    project.client_name,
    row.message.message_date || row.message.created_at,
    row.message.source,
    row.message.message_text,
    row.finding.classification,
    row.finding.request_type,
    row.finding.confidence_score,
    row.finding.estimated_hours,
    potential(row.finding).toFixed(2),
    row.finding.billing_decision,
    row.finding.workflow_status,
    row.finding.approved_hours,
    row.finding.approved_amount_cents == null
      ? ""
      : (row.finding.approved_amount_cents / 100).toFixed(2),
    row.finding.relevant_sow_sections.join(" | ")
  ]);

  return [header, ...body].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
