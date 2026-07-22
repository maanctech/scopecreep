import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { migrateStoreShape, type BusinessStore } from "@/lib/migrations/localStore";
import { splitSowSections } from "@/lib/sow/extraction";

const idSchema = z.string().trim().min(1).max(240);
const timestampSchema = z.string().datetime({ offset: true });
const nullableMoneySchema = z.number().finite().nonnegative().nullable();

const storeSchema = z.object({
  schema_version: z.number().int().positive(),
  users: z.array(z.object({ id: idSchema, email: z.string().email(), created_at: timestampSchema }).passthrough()),
  companies: z.array(z.object({ id: idSchema, name: z.string().trim().min(1), created_at: timestampSchema }).passthrough()),
  leads: z.array(z.object({
    id: idSchema,
    company_id: idSchema.nullable(),
    name: z.string().trim().min(1),
    email: z.string().email(),
    company: z.string().trim().min(1),
    average_project_value: nullableMoneySchema,
    hourly_rate: nullableMoneySchema,
    consent_to_contact: z.boolean(),
    created_at: timestampSchema
  }).passthrough()),
  leadStatusHistory: z.array(z.object({
    id: idSchema,
    lead_id: idSchema,
    created_at: timestampSchema
  }).passthrough()),
  auditRequests: z.array(z.object({
    id: idSchema,
    lead_id: idSchema.nullable(),
    company_id: idSchema.nullable(),
    hourly_rate: z.number().finite().positive(),
    project_value: nullableMoneySchema,
    sow_text: z.string(),
    message_export_text: z.string(),
    created_at: timestampSchema
  }).passthrough()),
  projects: z.array(z.object({
    id: idSchema,
    company_id: idSchema.nullable(),
    lead_id: idSchema.nullable(),
    audit_request_id: idSchema.nullable(),
    hourly_rate: z.number().finite().positive(),
    project_value: nullableMoneySchema,
    sow_text: z.string(),
    is_demo: z.boolean(),
    created_at: timestampSchema
  }).passthrough()),
  clientMessages: z.array(z.object({
    id: idSchema,
    project_id: idSchema,
    message_text: z.string().trim().min(1),
    created_at: timestampSchema
  }).passthrough()),
  scopeFindings: z.array(z.object({
    id: idSchema,
    project_id: idSchema,
    client_message_id: idSchema,
    confidence_score: z.number().finite().min(0).max(1),
    relevant_sow_sections: z.array(z.string()),
    estimated_hours: z.number().finite().nonnegative(),
    estimated_revenue: z.number().finite().nonnegative(),
    approved_amount_cents: z.number().int().nonnegative().nullable(),
    version: z.number().int().positive(),
    is_demo: z.boolean(),
    created_at: timestampSchema,
    updated_at: timestampSchema
  }).passthrough()),
  billingEvents: z.array(z.object({
    id: idSchema,
    project_id: idSchema,
    scope_finding_id: idSchema,
    amount_cents: z.number().int().nullable(),
    previous_amount_cents: z.number().int().nullable(),
    new_amount_cents: z.number().int().nullable(),
    is_demo: z.boolean(),
    created_at: timestampSchema
  }).passthrough()),
  reports: z.array(z.object({
    id: idSchema,
    project_id: idSchema,
    total_revenue_leakage: z.number().finite().nonnegative(),
    analyzed_messages_count: z.number().int().nonnegative(),
    out_of_scope_count: z.number().int().nonnegative(),
    created_at: timestampSchema
  }).passthrough()),
  salesTemplates: z.array(z.object({
    id: idSchema,
    title: z.string().trim().min(1),
    body: z.string(),
    created_at: timestampSchema,
    updated_at: timestampSchema
  }).passthrough())
});

function dollarsToCents(value: number | null) {
  return value === null ? null : Math.round(value * 100);
}

function uuidFrom(value: string) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

export function importedId(organizationId: string, kind: string, sourceId: string) {
  return uuidFrom(`scopeledger:${organizationId}:${kind}:${sourceId}`);
}

function assertUnique(collection: Array<{ id: string }>, label: string) {
  const ids = new Set<string>();
  for (const item of collection) {
    if (ids.has(item.id)) throw new Error(`${label} contains duplicate id ${item.id}.`);
    ids.add(item.id);
  }
  return ids;
}

function assertReference(id: string | null, ids: Set<string>, label: string) {
  if (id && !ids.has(id)) throw new Error(`${label} references missing id ${id}.`);
}

export type JsonImportPlan = {
  store: BusinessStore;
  summary: {
    companies: number;
    leads: number;
    auditRequests: number;
    projects: number;
    messages: number;
    findings: number;
    billingEvents: number;
    reports: number;
    salesTemplates: number;
    potentialRevenueCents: number;
    demoPotentialRevenueCents: number;
  };
  warnings: string[];
};

export function prepareJsonImport(raw: unknown): JsonImportPlan {
  const migrated = migrateStoreShape(raw).store;
  const parsed = storeSchema.parse(migrated) as BusinessStore;

  const companyIds = assertUnique(parsed.companies, "companies");
  const leadIds = assertUnique(parsed.leads, "leads");
  const auditIds = assertUnique(parsed.auditRequests, "auditRequests");
  const projectIds = assertUnique(parsed.projects, "projects");
  const messageIds = assertUnique(parsed.clientMessages, "clientMessages");
  const findingIds = assertUnique(parsed.scopeFindings, "scopeFindings");
  assertUnique(parsed.billingEvents, "billingEvents");
  assertUnique(parsed.reports, "reports");
  assertUnique(parsed.salesTemplates, "salesTemplates");

  parsed.leads.forEach((row) => assertReference(row.company_id, companyIds, `lead ${row.id}`));
  parsed.leadStatusHistory.forEach((row) => assertReference(row.lead_id, leadIds, `lead history ${row.id}`));
  parsed.auditRequests.forEach((row) => {
    assertReference(row.lead_id, leadIds, `audit request ${row.id}`);
    assertReference(row.company_id, companyIds, `audit request ${row.id}`);
  });
  parsed.projects.forEach((row) => {
    assertReference(row.company_id, companyIds, `project ${row.id}`);
    assertReference(row.lead_id, leadIds, `project ${row.id}`);
    assertReference(row.audit_request_id, auditIds, `project ${row.id}`);
  });
  parsed.clientMessages.forEach((row) => assertReference(row.project_id, projectIds, `message ${row.id}`));
  parsed.scopeFindings.forEach((row) => {
    assertReference(row.project_id, projectIds, `finding ${row.id}`);
    assertReference(row.client_message_id, messageIds, `finding ${row.id}`);
  });
  parsed.billingEvents.forEach((row) => {
    assertReference(row.project_id, projectIds, `billing event ${row.id}`);
    assertReference(row.scope_finding_id, findingIds, `billing event ${row.id}`);
  });
  parsed.reports.forEach((row) => assertReference(row.project_id, projectIds, `report ${row.id}`));

  const potentialRevenueCents = parsed.scopeFindings.reduce(
    (total, finding) => total + dollarsToCents(finding.classification === "In Scope" ? 0 : finding.estimated_revenue)!,
    0
  );
  const demoPotentialRevenueCents = parsed.scopeFindings.reduce(
    (total, finding) => total + (finding.is_demo && finding.classification !== "In Scope" ? dollarsToCents(finding.estimated_revenue)! : 0),
    0
  );

  return {
    store: parsed,
    summary: {
      companies: parsed.companies.length,
      leads: parsed.leads.length,
      auditRequests: parsed.auditRequests.length,
      projects: parsed.projects.length,
      messages: parsed.clientMessages.length,
      findings: parsed.scopeFindings.length,
      billingEvents: parsed.billingEvents.length,
      reports: parsed.reports.length,
      salesTemplates: parsed.salesTemplates.length,
      potentialRevenueCents,
      demoPotentialRevenueCents
    },
    warnings: parsed.users.length
      ? ["Legacy users are not imported because they do not contain password credentials. Create users through ScopeLedger setup."]
      : []
  };
}

type SqlClient = Pick<PoolClient, "query">;

export async function executeJsonImport(
  client: SqlClient,
  organizationId: string,
  plan: JsonImportPlan
) {
  const { store } = plan;
  const id = (kind: string, sourceId: string | null) =>
    sourceId ? importedId(organizationId, kind, sourceId) : null;

  for (const row of store.companies) {
    await client.query(
      `INSERT INTO companies (id, organization_id, name, website, business_type, team_size, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT (id) DO NOTHING`,
      [id("company", row.id), organizationId, row.name, row.website, row.business_type, row.team_size, row.created_at]
    );
  }

  for (const row of store.leads) {
    await client.query(
      `INSERT INTO leads
       (id, organization_id, company_id, name, email, company, website, business_type, team_size,
        average_project_value_cents, hourly_rate_cents, pain_point, consent_to_contact, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
       ON CONFLICT (id) DO NOTHING`,
      [id("lead", row.id), organizationId, id("company", row.company_id), row.name, row.email, row.company,
       row.website, row.business_type, row.team_size, dollarsToCents(row.average_project_value),
       dollarsToCents(row.hourly_rate), row.pain_point, row.consent_to_contact, row.status, row.created_at]
    );
  }

  for (const row of store.leadStatusHistory) {
    await client.query(
      `INSERT INTO lead_status_history
       (id, organization_id, lead_id, from_status, to_status, note, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [id("lead-history", row.id), organizationId, id("lead", row.lead_id), row.from_status, row.to_status, row.note, row.created_at]
    );
  }

  for (const row of store.auditRequests) {
    await client.query(
      `INSERT INTO audit_requests
       (id, organization_id, lead_id, company_id, client_name, project_value_cents, hourly_rate_cents,
        sow_text, message_export_text, suspected_scope_creep_notes, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) ON CONFLICT (id) DO NOTHING`,
      [id("audit-request", row.id), organizationId, id("lead", row.lead_id), id("company", row.company_id),
       row.client_name, dollarsToCents(row.project_value), dollarsToCents(row.hourly_rate), row.sow_text,
       row.message_export_text, row.suspected_scope_creep_notes, row.status, row.created_at]
    );
  }

  for (const row of store.projects) {
    const projectId = id("project", row.id)!;
    await client.query(
      `INSERT INTO projects
       (id, organization_id, company_id, lead_id, audit_request_id, client_name, project_name,
        hourly_rate_cents, project_value_cents, legacy_sow_text, is_demo, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) ON CONFLICT (id) DO NOTHING`,
      [projectId, organizationId, id("company", row.company_id), id("lead", row.lead_id),
       id("audit-request", row.audit_request_id), row.client_name, row.project_name,
       dollarsToCents(row.hourly_rate), dollarsToCents(row.project_value), row.sow_text, row.is_demo, row.created_at]
    );

    const documentId = id("sow-document", row.id)!;
    const versionId = id("sow-version", row.id)!;
    await client.query(
      `INSERT INTO sow_documents
       (id, organization_id, project_id, title, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'Active',$5,$5) ON CONFLICT (id) DO NOTHING`,
      [documentId, organizationId, projectId, `${row.project_name} Statement of Work`, row.created_at]
    );
    await client.query(
      `INSERT INTO sow_versions
       (id, organization_id, sow_document_id, version_number, source_type, content, content_sha256, change_note, created_at)
       VALUES ($1,$2,$3,1,'Imported JSON',$4,$5,'Imported from the legacy local store.',$6)
       ON CONFLICT (id) DO NOTHING`,
      [versionId, organizationId, documentId, row.sow_text, createHash("sha256").update(row.sow_text).digest("hex"), row.created_at]
    );
    for (const section of splitSowSections(row.sow_text)) {
      await client.query(
        `INSERT INTO sow_sections
         (id, organization_id, sow_version_id, heading, body, ordinal, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [importedId(organizationId, "sow-section", `${row.id}:${section.ordinal}`), organizationId,
         versionId, section.heading, section.body, section.ordinal, row.created_at]
      );
    }
    await client.query("UPDATE sow_documents SET current_version_id = $1 WHERE id = $2", [versionId, documentId]);
    await client.query(
      "UPDATE projects SET active_sow_version_id = $1 WHERE id = $2 AND organization_id = $3",
      [versionId, projectId, organizationId]
    );
  }

  for (const row of store.clientMessages) {
    await client.query(
      `INSERT INTO client_messages
       (id, organization_id, project_id, source, sender, message_text, message_date, content_sha256, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      [id("message", row.id), organizationId, id("project", row.project_id), row.source, row.sender,
       row.message_text, row.message_date || null, createHash("sha256").update(row.message_text).digest("hex"), row.created_at]
    );
  }

  for (const row of store.scopeFindings) {
    await client.query(
      `INSERT INTO scope_findings
       (id, organization_id, project_id, client_message_id, classification, confidence_score, reasoning,
        relevant_sow_sections, request_type, estimated_hours, estimated_revenue_cents, suggested_change_order,
        billing_decision, workflow_status, approved_hours, approved_amount_cents, client_facing_explanation,
        internal_note, reviewed_by_label, reviewed_at, version, is_demo, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       ON CONFLICT (id) DO NOTHING`,
      [id("finding", row.id), organizationId, id("project", row.project_id), id("message", row.client_message_id),
       row.classification, row.confidence_score, row.reasoning, JSON.stringify(row.relevant_sow_sections), row.request_type,
       row.estimated_hours, dollarsToCents(row.estimated_revenue), row.suggested_change_order, row.billing_decision,
       row.workflow_status, row.approved_hours, row.approved_amount_cents, row.client_facing_explanation,
       row.internal_note, row.reviewed_by, row.reviewed_at, row.version, row.is_demo, row.created_at, row.updated_at]
    );
  }

  for (const row of store.billingEvents) {
    await client.query(
      `INSERT INTO billing_events
       (id, organization_id, project_id, scope_finding_id, event_type, amount_cents, previous_amount_cents,
        new_amount_cents, previous_status, new_status, previous_decision, new_decision, note, actor_label, is_demo, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO NOTHING`,
      [id("billing-event", row.id), organizationId, id("project", row.project_id), id("finding", row.scope_finding_id),
       row.event_type, row.amount_cents, row.previous_amount_cents, row.new_amount_cents, row.previous_status,
       row.new_status, row.previous_decision, row.new_decision, row.note, row.actor, row.is_demo, row.created_at]
    );
  }

  for (const row of store.reports) {
    const reportId = id("report", row.id)!;
    const versionId = id("report-version", row.id)!;
    await client.query(
      `INSERT INTO reports (id, organization_id, project_id, title, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$5) ON CONFLICT (id) DO NOTHING`,
      [reportId, organizationId, id("project", row.project_id), row.title, row.created_at]
    );
    await client.query(
      `INSERT INTO report_versions
       (id, organization_id, report_id, version_number, markdown, total_revenue_leakage_cents,
        analyzed_messages_count, out_of_scope_count, created_at)
       VALUES ($1,$2,$3,1,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [versionId, organizationId, reportId, row.markdown, dollarsToCents(row.total_revenue_leakage),
       row.analyzed_messages_count, row.out_of_scope_count, row.created_at]
    );
    await client.query("UPDATE reports SET current_version_id = $1 WHERE id = $2", [versionId, reportId]);
  }

  for (const row of store.salesTemplates) {
    await client.query(
      `INSERT INTO sales_templates
       (id, organization_id, template_type, title, body, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [id("sales-template", row.id), organizationId, row.template_type, row.title, row.body, row.created_at, row.updated_at]
    );
  }

  return plan.summary;
}
