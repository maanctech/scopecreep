import type { BillingEventWithContext, FindingWithContext } from "@/lib/types";

export type FindingFilters = {
  client?: string;
  project?: string;
  classification?: string;
  decision?: string;
  status?: string;
  from?: string;
  to?: string;
};

export type BillingEventFilters = {
  client?: string;
  project?: string;
  type?: string;
  status?: string;
  from?: string;
  to?: string;
};

export type ProjectOption = { id: string; project_name: string; client_name: string };

export type FilterOptions = { clients: string[]; projects: ProjectOption[] };

function withinDates(timestamp: string, from?: string, to?: string) {
  const day = timestamp.slice(0, 10);

  if (from && day < from) return false;

  if (to && day > to) return false;

  return true;
}

export function matchesFindingFilters(row: FindingWithContext, filters: FindingFilters) {
  const { finding, project } = row;

  if (filters.client && project?.client_name !== filters.client) return false;

  if (filters.project && project?.id !== filters.project) return false;

  if (filters.classification && finding.classification !== filters.classification) return false;

  if (filters.decision && finding.billing_decision !== filters.decision) return false;

  if (filters.status && finding.workflow_status !== filters.status) return false;

  return withinDates(finding.created_at, filters.from, filters.to);
}

export function matchesBillingEventFilters(row: BillingEventWithContext, filters: BillingEventFilters) {
  const { event, project } = row;

  if (filters.client && project?.client_name !== filters.client) return false;

  if (filters.project && project?.id !== filters.project) return false;

  if (filters.type && event.event_type !== filters.type) return false;

  if (filters.status && event.new_status !== filters.status) return false;

  return withinDates(event.created_at, filters.from, filters.to);
}
