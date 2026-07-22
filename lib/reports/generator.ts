import { formatCents, formatDollars } from "@/lib/domain/money";
import { computeRevenueTotals } from "@/lib/domain/revenueTotals";
import type { MessageWithFinding, Project, ReportType, ScopeFinding } from "@/lib/types";

type ReportInput = {
  reportType: ReportType;
  project: Project;
  rows: MessageWithFinding[];
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
    const drafts = flagged
      .map(
        (row, index) => `## Draft ${index + 1}: ${row.finding.request_type}

Requested work: ${markdownText(row.message.message_text)}

Estimated additional effort: ${row.finding.estimated_hours} hours
Estimated amount: ${formatDollars(potential(row.finding))}

SOW evidence:
${evidence(row.finding)}

Client-facing draft - not sent:
${markdownText(row.finding.client_facing_explanation)}`
      )
      .join("\n\n");
    return `${reportHeader(input, true)}

${drafts || "No flagged requests are available for a change-order draft."}

${footer}`;
  }

  if (input.reportType === "Invoice Support Summary") {
    const invoiceRows = analyzed.filter(
      (row) =>
        row.finding.billing_decision === "Bill Separately" &&
        ["Decided", "Discussing", "Invoiced", "Paid"].includes(row.finding.workflow_status)
    );
    const items = invoiceRows
      .map(
        (row, index) => `${index + 1}. ${markdownText(row.message.message_text)}
   - Approved hours: ${row.finding.approved_hours ?? "Not set"}
   - Approved amount: ${formatCents(row.finding.approved_amount_cents || 0)}
   - Status: ${row.finding.workflow_status}
   - Evidence: ${row.finding.relevant_sow_sections.map(markdownText).join("; ") || "Human verification required"}`
      )
      .join("\n");
    const approved = invoiceRows.reduce(
      (sum, row) => sum + (row.finding.approved_amount_cents || 0),
      0
    );
    return `${reportHeader(input)}

## Approved Separately Billable Work

${items || "No findings are currently approved as separately billable."}

Total approved amount represented: ${formatCents(approved)}

This summary supports manual invoicing only. Verify invoice details in the billing system of record.

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
