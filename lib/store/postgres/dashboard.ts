import { withStoreContext } from "@/lib/store/postgres/client";
import {
  loadDashboardFindings,
  loadEvents,
  loadEventsForFinding,
  loadEventsForProject,
  loadFindingById,
  loadFindings,
  loadFindingsByIds,
  loadMessagesByIds,
  loadProject,
  loadProjectRows,
  loadProjects,
  loadProjectsByIds,
  type DashboardFinding
} from "@/lib/store/postgres/loaders";
import { loadEventsPage, loadFindingsPage, loadProjectOptions, loadRevenueGroups } from "@/lib/store/postgres/lists";
import { summariseProjects } from "@/lib/store/postgres/summaries";
import {
  computeRevenueTotals,
  computeSplitRevenueTotalsFromGroups,
  emptyRevenueTotals
} from "@/lib/domain/revenueTotals";
import type { BillingEventFilters, FilterOptions, FindingFilters } from "@/lib/store/filters";
import type { Page, PageRequest } from "@/lib/store/pagination";
import type { AppDashboard } from "@/lib/store/json";
import type { BillingEvent, BillingEventWithContext, FindingWithContext, ProjectDetail } from "@/lib/types";

const decisionEvents: BillingEvent["event_type"][] = ["Approved Internally", "Included In Retainer", "Discussing With Client", "Absorbed", "Rejected", "Reopened", "Decision Updated"];

const ATTENTION_LIMIT = 6;
const RECENT_EVENT_LIMIT = 8;
const RECENT_DECISION_LIMIT = 6;

async function withContext(organizationId: string, findings: Array<{ id: string; project_id: string; client_message_id: string }>) {
  const [messages, projects] = await Promise.all([
    loadMessagesByIds(organizationId, findings.map((finding) => finding.client_message_id)),
    loadProjectsByIds(organizationId, findings.map((finding) => finding.project_id))
  ]);

  return { messages, projects };
}

export async function getAppDashboard(): Promise<AppDashboard> {
  return withStoreContext(async (context) => {
    const [projects, findings, recentEventRows, decisionEventRows] = await Promise.all([
      loadProjects(context.organizationId),
      loadDashboardFindings(context.organizationId),
      loadEvents(context.organizationId, { limit: RECENT_EVENT_LIMIT }),
      loadEvents(context.organizationId, { limit: RECENT_DECISION_LIMIT, eventTypes: decisionEvents })
    ]);
    const attentionRows = findings
      .filter((finding) => finding.billing_decision === "Undecided" && finding.classification !== "In Scope")
      .sort((a, b) => b.estimated_revenue - a.estimated_revenue)
      .slice(0, ATTENTION_LIMIT);

    const [attention, events] = await Promise.all([
      attentionContext(context.organizationId, attentionRows),
      eventContext(context.organizationId, [...recentEventRows, ...decisionEventRows])
    ]);
    const demoFindings = findings.filter((finding) => finding.is_demo);
    const realFindings = findings.filter((finding) => !finding.is_demo);
    const groups = new Map<string, { client_name: string; is_demo: boolean; findings: DashboardFinding[] }>();

    for (const project of projects) {
      const key = `${project.client_name}|${project.is_demo}`;
      const group = groups.get(key) ?? { client_name: project.client_name, is_demo: project.is_demo, findings: [] };

      group.findings.push(...findings.filter((finding) => finding.project_id === project.id));
      groups.set(key, group);
    }

    return {
      projects: summariseProjects(projects, findings),
      demoTotals: demoFindings.length ? computeRevenueTotals(demoFindings) : emptyRevenueTotals(),
      realTotals: realFindings.length ? computeRevenueTotals(realFindings) : emptyRevenueTotals(),
      hasDemoFindings: demoFindings.length > 0,
      hasRealFindings: realFindings.length > 0,
      attention,
      recentDecisions: decisionEventRows.map((event) => events.get(event.id)!),
      recentEvents: recentEventRows.map((event) => events.get(event.id)!),
      revenueByProject: projects.map((project) => ({
        project, totals: computeRevenueTotals(findings.filter((finding) => finding.project_id === project.id))
      })).sort((a, b) => b.totals.potential_dollars - a.totals.potential_dollars),
      revenueByClient: Array.from(groups.values()).map((group) => ({
        client_name: group.client_name, is_demo: group.is_demo, totals: computeRevenueTotals(group.findings)
      })).sort((a, b) => b.totals.potential_dollars - a.totals.potential_dollars)
    };
  });
}

async function attentionContext(organizationId: string, rows: DashboardFinding[]): Promise<FindingWithContext[]> {
  if (!rows.length) return [];

  const [full, { messages, projects }] = await Promise.all([
    loadFindingsByIds(organizationId, rows.map((row) => row.id)),
    withContext(organizationId, rows)
  ]);

  return rows.flatMap((row) => {
    const finding = full.get(row.id);

    return finding ? [{
      finding,
      message: messages.get(finding.client_message_id) ?? null,
      project: projects.get(finding.project_id) ?? null
    }] : [];
  });
}

async function eventContext(organizationId: string, events: BillingEvent[]) {
  const findingIds = events.flatMap((event) => event.scope_finding_id ? [event.scope_finding_id] : []);
  const [findings, projects] = await Promise.all([
    loadFindingsByIds(organizationId, findingIds),
    loadProjectsByIds(organizationId, events.map((event) => event.project_id))
  ]);

  return new Map(events.map((event) => [event.id, {
    event,
    finding: event.scope_finding_id ? findings.get(event.scope_finding_id) ?? null : null,
    project: projects.get(event.project_id) ?? null
  }]));
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  return withStoreContext(async (context) => {
    const project = await loadProject(context.organizationId, projectId);

    return project ? { project, messages: await loadProjectRows(context.organizationId, projectId) } : null;
  });
}

export async function getFindings(): Promise<FindingWithContext[]> {
  return withStoreContext(async (context) => {
    const findings = await loadFindings(context.organizationId);
    const { messages, projects } = await withContext(context.organizationId, findings);

    return findings.map((finding) => ({
      finding,
      message: messages.get(finding.client_message_id) ?? null,
      project: projects.get(finding.project_id) ?? null
    }));
  });
}

export async function listFindings(
  filters: FindingFilters,
  request: PageRequest = {}
): Promise<Page<FindingWithContext>> {
  return withStoreContext(async (context) => {
    const page = await loadFindingsPage(context.organizationId, filters, request);
    const { messages, projects } = await withContext(context.organizationId, page.rows);

    return {
      rows: page.rows.map((finding) => ({
        finding,
        message: messages.get(finding.client_message_id) ?? null,
        project: projects.get(finding.project_id) ?? null
      })),
      nextCursor: page.nextCursor
    };
  });
}

export async function listBillingEvents(
  filters: BillingEventFilters,
  request: PageRequest = {}
): Promise<Page<BillingEventWithContext>> {
  return withStoreContext(async (context) => {
    const page = await loadEventsPage(context.organizationId, filters, request);
    const contextByEvent = await eventContext(context.organizationId, page.rows);

    return { rows: page.rows.map((event) => contextByEvent.get(event.id)!), nextCursor: page.nextCursor };
  });
}

/**
 * The filter dropdowns used to be built from whatever the page had already
 * loaded, which is one of the reasons it had to load everything. A firm's
 * projects are few and are the real list of choices.
 */
export async function getFilterOptions(): Promise<FilterOptions> {
  return withStoreContext(async (context) => {
    const projects = await loadProjectOptions(context.organizationId);

    return { clients: [...new Set(projects.map((project) => project.client_name))], projects };
  });
}

export async function getRevenueSplit() {
  return withStoreContext(async (context) => {
    const groups = await loadRevenueGroups(context.organizationId);

    return {
      ...computeSplitRevenueTotalsFromGroups(groups),
      hasDemoFindings: groups.some((group) => group.is_demo),
      hasRealFindings: groups.some((group) => !group.is_demo)
    };
  });
}

export async function getFindingDetail(findingId: string) {
  return withStoreContext(async (context) => {
    const finding = await loadFindingById(context.organizationId, findingId);

    if (!finding) return null;

    const [{ messages, projects }, events] = await Promise.all([
      withContext(context.organizationId, [finding]),
      loadEventsForFinding(context.organizationId, finding.id)
    ]);

    return {
      finding,
      message: messages.get(finding.client_message_id) ?? null,
      project: projects.get(finding.project_id) ?? null,
      events
    };
  });
}

/**
 * The project page renders each finding with its own history. It used to load
 * every event in the organization and scan that list once per finding card,
 * which cost more the longer a firm had been a customer and had nothing to do
 * with the project being looked at.
 */
export async function getProjectFindingEvents(projectId: string) {
  return withStoreContext(async (context) => {
    const events = await loadEventsForProject(context.organizationId, projectId);
    const byFinding = new Map<string, BillingEvent[]>();

    for (const event of events) {
      if (!event.scope_finding_id) continue;

      byFinding.set(event.scope_finding_id, [...byFinding.get(event.scope_finding_id) ?? [], event]);
    }

    return byFinding;
  });
}

export async function getBillingEvents() {
  return withStoreContext(async (context) => {
    const events = await loadEvents(context.organizationId);
    const contextByEvent = await eventContext(context.organizationId, events);

    return events.map((event) => contextByEvent.get(event.id)!);
  });
}
