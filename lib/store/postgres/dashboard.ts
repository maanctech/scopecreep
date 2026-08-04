import { requireContext } from "@/lib/store/postgres/client";
import { contextEvent, contextFinding, projectSummary, rowsForProject, snapshot } from "@/lib/store/postgres/projections";
import { computeRevenueTotals, emptyRevenueTotals } from "@/lib/domain/revenueTotals";
import type { AppDashboard } from "@/lib/store/json";
import type { BillingEvent, ProjectDetail, ScopeFinding } from "@/lib/types";

const decisionEvents: BillingEvent["event_type"][] = ["Approved Internally", "Included In Retainer", "Discussing With Client", "Absorbed", "Rejected", "Reopened", "Decision Updated"];

export async function getAppDashboard(): Promise<AppDashboard> {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);
  const demoFindings = data.findings.filter((finding) => finding.is_demo);
  const realFindings = data.findings.filter((finding) => !finding.is_demo);
  const events = data.events.map((event) => contextEvent(event, data));
  const revenueByProject = data.projects.map((project) => ({
    project, totals: computeRevenueTotals(data.findings.filter((finding) => finding.project_id === project.id))
  })).sort((a, b) => b.totals.potential_dollars - a.totals.potential_dollars);
  const groups = new Map<string, { client_name: string; is_demo: boolean; findings: ScopeFinding[] }>();

  for (const project of data.projects) {
    const key = `${project.client_name}|${project.is_demo}`;
    const group = groups.get(key) ?? { client_name: project.client_name, is_demo: project.is_demo, findings: [] };

    group.findings.push(...data.findings.filter((finding) => finding.project_id === project.id));
    groups.set(key, group);
  }

  return {
    projects: data.projects.map((project) => projectSummary(project, data)),
    demoTotals: demoFindings.length ? computeRevenueTotals(demoFindings) : emptyRevenueTotals(),
    realTotals: realFindings.length ? computeRevenueTotals(realFindings) : emptyRevenueTotals(),
    hasDemoFindings: demoFindings.length > 0,
    hasRealFindings: realFindings.length > 0,
    attention: data.findings.filter((finding) => finding.billing_decision === "Undecided" && finding.classification !== "In Scope")
      .sort((a, b) => b.estimated_revenue - a.estimated_revenue).slice(0, 6).map((finding) => contextFinding(finding, data)),
    recentDecisions: events.filter(({ event }) => decisionEvents.includes(event.event_type)).slice(0, 6),
    recentEvents: events.slice(0, 8),
    revenueByProject,
    revenueByClient: Array.from(groups.values()).map((group) => ({
      client_name: group.client_name, is_demo: group.is_demo, totals: computeRevenueTotals(group.findings)
    })).sort((a, b) => b.totals.potential_dollars - a.totals.potential_dollars)
  };
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);
  const project = data.projects.find((row) => row.id === projectId);

  return project ? { project, messages: rowsForProject(projectId, data) } : null;
}

export async function getFindings() {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);

  return data.findings.map((finding) => contextFinding(finding, data));
}

export async function getFindingDetail(findingId: string) {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);
  const finding = data.findings.find((row) => row.id === findingId);

  return finding ? {
    ...contextFinding(finding, data),
    events: data.events.filter((event) => event.scope_finding_id === finding.id)
  } : null;
}

export async function getBillingEvents() {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);

  return data.events.map((event) => contextEvent(event, data));
}
