import { readLocalStore } from "@/lib/store/json/persistence";
import {
  rowsForProject,
  sortEventsNewestFirst,
  summarizeProject,
  withEventContext,
  withFindingContext
} from "@/lib/store/json/projections";
import { computeRevenueTotals, emptyRevenueTotals, type RevenueTotals } from "@/lib/domain/revenueTotals";
import type {
  BillingEvent,
  BillingEventWithContext,
  FindingWithContext,
  Project,
  ProjectDetail,
  ProjectSummary,
  ScopeFinding
} from "@/lib/types";

const DECISION_EVENT_TYPES: BillingEvent["event_type"][] = [
  "Approved Internally",
  "Included In Retainer",
  "Discussing With Client",
  "Absorbed",
  "Rejected",
  "Reopened",
  "Decision Updated"
];

export type AppDashboard = {
  projects: ProjectSummary[];
  /** Fictional demonstration totals; never merged with real totals. */
  demoTotals: RevenueTotals;
  /** Totals over real (non-demo) findings only. */
  realTotals: RevenueTotals;
  hasDemoFindings: boolean;
  hasRealFindings: boolean;
  attention: FindingWithContext[];
  recentDecisions: BillingEventWithContext[];
  recentEvents: BillingEventWithContext[];
  revenueByProject: Array<{ project: Project; totals: RevenueTotals }>;
  revenueByClient: Array<{ client_name: string; is_demo: boolean; totals: RevenueTotals }>;
};

export async function getAppDashboard(): Promise<AppDashboard> {
  const store = await readLocalStore();
  const projects = store.projects.map((project) => summarizeProject(project, store));
  const demoFindings = store.scopeFindings.filter((finding) => finding.is_demo);
  const realFindings = store.scopeFindings.filter((finding) => !finding.is_demo);

  const attention = store.scopeFindings
    .filter(
      (finding) =>
        finding.billing_decision === "Undecided" && finding.classification !== "In Scope"
    )
    .sort((a, b) => b.estimated_revenue - a.estimated_revenue)
    .slice(0, 6)
    .map((finding) => withFindingContext(finding, store));

  const eventsNewestFirst = sortEventsNewestFirst(store.billingEvents);
  const recentDecisions = eventsNewestFirst
    .filter((event) => DECISION_EVENT_TYPES.includes(event.event_type))
    .slice(0, 6)
    .map((event) => withEventContext(event, store));
  const recentEvents = eventsNewestFirst
    .slice(0, 8)
    .map((event) => withEventContext(event, store));

  const revenueByProject = store.projects
    .map((project) => ({
      project,
      totals: computeRevenueTotals(
        store.scopeFindings.filter((finding) => finding.project_id === project.id)
      )
    }))
    .sort((a, b) => b.totals.potential_dollars - a.totals.potential_dollars);

  const clientGroups = new Map<string, { client_name: string; is_demo: boolean; findings: ScopeFinding[] }>();

  for (const project of store.projects) {
    const key = `${project.client_name}|${project.is_demo}`;
    const group = clientGroups.get(key) ?? {
      client_name: project.client_name,
      is_demo: project.is_demo,
      findings: []
    };

    group.findings.push(
      ...store.scopeFindings.filter((finding) => finding.project_id === project.id)
    );
    clientGroups.set(key, group);
  }

  const revenueByClient = Array.from(clientGroups.values())
    .map((group) => ({
      client_name: group.client_name,
      is_demo: group.is_demo,
      totals: computeRevenueTotals(group.findings)
    }))
    .sort((a, b) => b.totals.potential_dollars - a.totals.potential_dollars);

  return {
    projects,
    demoTotals: demoFindings.length ? computeRevenueTotals(demoFindings) : emptyRevenueTotals(),
    realTotals: realFindings.length ? computeRevenueTotals(realFindings) : emptyRevenueTotals(),
    hasDemoFindings: demoFindings.length > 0,
    hasRealFindings: realFindings.length > 0,
    attention,
    recentDecisions,
    recentEvents,
    revenueByProject,
    revenueByClient
  };
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const store = await readLocalStore();
  const project = store.projects.find((item) => item.id === projectId);

  if (!project) return null;

  return { project, messages: rowsForProject(project.id, store) };
}

export async function getFindings(): Promise<FindingWithContext[]> {
  const store = await readLocalStore();

  return store.scopeFindings
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((finding) => withFindingContext(finding, store));
}

export async function getFindingDetail(findingId: string): Promise<
  (FindingWithContext & { events: BillingEvent[] }) | null
> {
  const store = await readLocalStore();
  const finding = store.scopeFindings.find((item) => item.id === findingId);

  if (!finding) return null;

  return {
    ...withFindingContext(finding, store),
    events: sortEventsNewestFirst(
      store.billingEvents.filter((event) => event.scope_finding_id === finding.id)
    )
  };
}

export async function getBillingEvents(): Promise<BillingEventWithContext[]> {
  const store = await readLocalStore();

  return sortEventsNewestFirst(store.billingEvents).map((event) => withEventContext(event, store));
}
