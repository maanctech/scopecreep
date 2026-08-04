import { randomUUID } from "node:crypto";
import { now } from "@/lib/store/json/persistence";
import type { BusinessStore } from "@/lib/migrations/localStore";
import type {
  BillingEvent,
  BillingEventWithContext,
  Company,
  FindingWithContext,
  MessageWithFinding,
  Project,
  ProjectSummary,
  ScopeFinding
} from "@/lib/types";

/** Legacy dollars: potential revenue of one flagged finding. */
export function findingPotential(finding: ScopeFinding | null) {
  if (!finding || finding.classification === "In Scope") return 0;

  return finding.estimated_revenue;
}

export function rowsForProject(projectId: string, store: BusinessStore): MessageWithFinding[] {
  const findingByMessageId = new Map(
    store.scopeFindings.map((finding) => [finding.client_message_id, finding])
  );

  return store.clientMessages
    .filter((message) => message.project_id === projectId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((message) => ({
      message,
      finding: findingByMessageId.get(message.id) ?? null
    }));
}

export function summarizeProject(project: Project, store: BusinessStore): ProjectSummary {
  const rows = rowsForProject(project.id, store);

  return {
    ...project,
    messages_analyzed: rows.filter((row) => row.finding).length,
    out_of_scope_count: rows.filter((row) => row.finding?.classification === "Out of Scope").length,
    potential_recovered_revenue: rows.reduce((sum, row) => sum + findingPotential(row.finding), 0)
  };
}

export function findOrCreateCompany(store: BusinessStore, input: {
  name: string;
  website?: string | null;
  business_type?: string | null;
  team_size?: string | null;
}) {
  const normalizedName = input.name.trim().toLowerCase();
  const existing = store.companies.find((company) => company.name.trim().toLowerCase() === normalizedName);

  if (existing) return existing;

  const company: Company = {
    id: randomUUID(),
    name: input.name.trim(),
    website: input.website?.trim() || null,
    business_type: input.business_type?.trim() || null,
    team_size: input.team_size?.trim() || null,
    created_at: now()
  };

  store.companies.unshift(company);

  return company;
}

/** Newest first; equal timestamps fall back to append order (later = newer). */
export function sortEventsNewestFirst(events: BillingEvent[]): BillingEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const byDate = b.event.created_at.localeCompare(a.event.created_at);

      return byDate !== 0 ? byDate : b.index - a.index;
    })
    .map((item) => item.event);
}

export function withFindingContext(finding: ScopeFinding, store: BusinessStore): FindingWithContext {
  return {
    finding,
    message: store.clientMessages.find((message) => message.id === finding.client_message_id) ?? null,
    project: store.projects.find((project) => project.id === finding.project_id) ?? null
  };
}

export function withEventContext(event: BillingEvent, store: BusinessStore): BillingEventWithContext {
  return {
    event,
    finding: store.scopeFindings.find((finding) => finding.id === event.scope_finding_id) ?? null,
    project: store.projects.find((project) => project.id === event.project_id) ?? null
  };
}
