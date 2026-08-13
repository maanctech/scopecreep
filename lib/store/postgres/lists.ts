import { query } from "@/lib/db/client";
import { dollars, type DbRow } from "@/lib/store/postgres/client";
import { mapEvent, mapFinding } from "@/lib/store/postgres/mappers";
import type { BillingEventFilters, FindingFilters, ProjectOption } from "@/lib/store/filters";
import type { RevenueGroup } from "@/lib/domain/revenueTotals";
import { decodeCursor, isUuid, pageSize, toPage, type Page, type PageRequest } from "@/lib/store/pagination";
import type { BillingEvent, ScopeFinding } from "@/lib/types";

/**
 * The findings and billing pages read one screenful at a time, ordered by
 * (created_at, id) so a page boundary is a value rather than a row count. An
 * offset would re-read and discard everything above the page, and would drop a
 * row whenever a finding arrived between one page and the next.
 */
type FilteredQuery = {
  parameters: unknown[];
  clauses: string[];
  restrict: (clause: (placeholder: string) => string, value: unknown) => void;
};

function filteredQuery(organizationId: string): FilteredQuery {
  const parameters: unknown[] = [organizationId];
  const clauses: string[] = [];

  return {
    parameters,
    clauses,
    restrict(clause, value) {
      if (value === undefined || value === null || value === "") return;

      parameters.push(value);
      clauses.push(clause(`$${parameters.length}`));
    }
  };
}

/**
 * A firm types dates as calendar days and reads timestamps as UTC everywhere
 * else in the product, so both bounds are anchored to UTC rather than to
 * whatever timezone the database session happens to carry. The cast to
 * timestamp is what makes AT TIME ZONE read as "this wall clock is UTC"; given
 * a date it would instead convert one already resolved in the session zone.
 */
function restrictDates(built: FilteredQuery, column: string, from?: string, to?: string) {
  built.restrict((at) => `${column} >= ((${at}::date)::timestamp AT TIME ZONE 'UTC')`, from);
  built.restrict((at) => `${column} < ((${at}::date + 1)::timestamp AT TIME ZONE 'UTC')`, to);
}

function restrictToCursor(built: FilteredQuery, columns: string, cursor: string | null | undefined) {
  const decoded = decodeCursor(cursor);

  if (!decoded) return;

  built.parameters.push(decoded.createdAt, decoded.id);
  built.clauses.push(
    `${columns} < ($${built.parameters.length - 1}::timestamptz, $${built.parameters.length}::uuid)`
  );
}

function where(built: FilteredQuery, organizationColumn: string) {
  return `${organizationColumn} = $1${built.clauses.map((clause) => ` AND ${clause}`).join("")}`;
}

export async function loadFindingsPage(
  organizationId: string,
  filters: FindingFilters,
  request: PageRequest
): Promise<Page<ScopeFinding>> {
  const limit = pageSize(request.limit);

  if (filters.project && !isUuid(filters.project)) return { rows: [], nextCursor: null };

  const built = filteredQuery(organizationId);

  built.restrict((at) => `p.client_name = ${at}`, filters.client);
  built.restrict((at) => `f.project_id = ${at}::uuid`, filters.project);
  built.restrict((at) => `f.classification = ${at}`, filters.classification);
  built.restrict((at) => `f.billing_decision = ${at}`, filters.decision);
  built.restrict((at) => `f.workflow_status = ${at}`, filters.status);
  restrictDates(built, "f.created_at", filters.from, filters.to);
  restrictToCursor(built, "(f.created_at, f.id)", request.cursor);
  built.parameters.push(limit + 1);

  const rows = await query<DbRow>(
    `SELECT f.* FROM scope_findings f
     LEFT JOIN projects p ON p.id = f.project_id AND p.organization_id = f.organization_id
     WHERE ${where(built, "f.organization_id")}
     ORDER BY f.created_at DESC, f.id DESC
     LIMIT $${built.parameters.length}`,
    built.parameters
  );

  return toPage(rows.rows.map(mapFinding), limit);
}

export async function loadEventsPage(
  organizationId: string,
  filters: BillingEventFilters,
  request: PageRequest
): Promise<Page<BillingEvent>> {
  const limit = pageSize(request.limit);

  if (filters.project && !isUuid(filters.project)) return { rows: [], nextCursor: null };

  const built = filteredQuery(organizationId);

  built.restrict((at) => `p.client_name = ${at}`, filters.client);
  built.restrict((at) => `e.project_id = ${at}::uuid`, filters.project);
  built.restrict((at) => `e.event_type = ${at}`, filters.type);
  built.restrict((at) => `e.new_status = ${at}`, filters.status);
  restrictDates(built, "e.created_at", filters.from, filters.to);
  restrictToCursor(built, "(e.created_at, e.id)", request.cursor);
  built.parameters.push(limit + 1);

  const rows = await query<DbRow>(
    `SELECT e.* FROM billing_events e
     LEFT JOIN projects p ON p.id = e.project_id AND p.organization_id = e.organization_id
     WHERE ${where(built, "e.organization_id")}
     ORDER BY e.created_at DESC, e.id DESC
     LIMIT $${built.parameters.length}`,
    built.parameters
  );

  return toPage(rows.rows.map(mapEvent), limit);
}

export async function loadProjectOptions(organizationId: string): Promise<ProjectOption[]> {
  const rows = await query<DbRow>(
    `SELECT id, project_name, client_name FROM projects
     WHERE organization_id = $1 AND archived_at IS NULL
     ORDER BY client_name, project_name`,
    [organizationId]
  );

  return rows.rows.map((row) => ({
    id: String(row.id),
    project_name: String(row.project_name),
    client_name: String(row.client_name)
  }));
}

/**
 * One row per combination of the columns that decide a revenue bucket. The
 * rules themselves stay in the domain module: this only reduces the number of
 * rows they have to be applied to, from every finding a firm has recorded to
 * the few dozen distinct combinations those findings fall into.
 */
export async function loadRevenueGroups(organizationId: string): Promise<RevenueGroup[]> {
  const rows = await query<DbRow>(
    `SELECT classification, billing_decision, workflow_status, is_demo,
            count(*)::int AS finding_count,
            COALESCE(sum(estimated_revenue_cents), 0)::bigint AS estimated_revenue_cents,
            COALESCE(sum(approved_amount_cents), 0)::bigint AS approved_amount_cents
     FROM scope_findings
     WHERE organization_id = $1
     GROUP BY classification, billing_decision, workflow_status, is_demo`,
    [organizationId]
  );

  return rows.rows.map((row) => ({
    classification: row.classification as ScopeFinding["classification"],
    billing_decision: row.billing_decision as ScopeFinding["billing_decision"],
    workflow_status: row.workflow_status as ScopeFinding["workflow_status"],
    is_demo: Boolean(row.is_demo),
    finding_count: Number(row.finding_count),
    estimated_revenue: dollars(row.estimated_revenue_cents),
    approved_amount_cents: Number(row.approved_amount_cents)
  }));
}
