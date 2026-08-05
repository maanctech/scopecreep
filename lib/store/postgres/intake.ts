import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { query, transaction } from "@/lib/db/client";
import { cents, publicOrganizationId, requireContext, type DbRow } from "@/lib/store/postgres/client";
import { findOrCreateCompany } from "@/lib/store/postgres/projections";
import { mapAuditRequest, mapLead, mapProject } from "@/lib/store/postgres/mappers";
import { splitSowSections } from "@/lib/sow/extraction";
import { parseManualImport } from "@/lib/ingestion/manual";
import { persistManualMessages } from "@/lib/ingestion/service";
import { auditIntakeTokenHash, createAuditIntakeCredential } from "@/lib/publicIntake";
import { NotFoundError } from "@/lib/storeErrors";
import type { LeadStatus } from "@/lib/types";

export async function createLead(input: {
  name: string; email: string; company: string; website?: string | null; business_type: string;
  team_size: string; average_project_value?: number | null; hourly_rate?: number | null;
  pain_point: string; consent_to_contact: boolean;
}) {
  const organizationId = await publicOrganizationId();
  const credential = createAuditIntakeCredential();

  return transaction(async (client) => {
    const companyId = await findOrCreateCompany(client, organizationId, input.company, {
      website: input.website, businessType: input.business_type, teamSize: input.team_size
    });
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const result = await client.query(
      `INSERT INTO leads
       (id, organization_id, company_id, name, email, company, website, business_type, team_size,
        average_project_value_cents, hourly_rate_cents, pain_point, consent_to_contact, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'New',$14,$14) RETURNING *`,
      [id, organizationId, companyId, input.name.trim(), input.email.trim().toLowerCase(), input.company.trim(),
       input.website?.trim() || null, input.business_type.trim(), input.team_size.trim(), cents(input.average_project_value),
       cents(input.hourly_rate), input.pain_point.trim(), input.consent_to_contact, createdAt]
    );

    await client.query(
      `INSERT INTO lead_status_history (id, organization_id, lead_id, from_status, to_status, note, created_at)
       VALUES ($1,$2,$3,NULL,'New','Lead submitted free audit request.',$4)`,
      [randomUUID(), organizationId, id, createdAt]
    );

    await client.query(
      `INSERT INTO audit_intake_tokens
       (id, organization_id, lead_id, token_sha256, expires_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [randomUUID(), organizationId, id, credential.tokenHash, credential.expiresAt.toISOString()]
    );

    return {
      ...mapLead(result.rows[0]),
      intakeToken: credential.token,
      intakeExpiresAt: credential.expiresAt,
    };
  });
}

export async function updateLeadStatus(input: { lead_id: string; status: LeadStatus; note?: string | null }) {
  const context = await requireContext();

  return transaction(async (client) => {
    const current = await client.query<DbRow>(
      "SELECT * FROM leads WHERE id = $1 AND organization_id = $2 FOR UPDATE", [input.lead_id, context.organizationId]
    );

    if (!current.rows[0]) throw new Error("Lead not found.");

    await client.query("UPDATE leads SET status = $1, updated_at = now() WHERE id = $2 AND organization_id = $3", [input.status, input.lead_id, context.organizationId]);
    await client.query(
      `INSERT INTO lead_status_history
       (id, organization_id, lead_id, from_status, to_status, note, actor_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [randomUUID(), context.organizationId, input.lead_id, current.rows[0].status, input.status, input.note?.trim() || null, context.userId]
    );

    return mapLead({ ...current.rows[0], status: input.status });
  });
}

async function insertProjectAndSow(client: PoolClient, organizationId: string, input: {
  companyId: string | null; leadId: string | null; auditRequestId: string | null; clientName: string;
  projectName: string; hourlyRate: number; projectValue: number | null; sowText: string; isDemo?: boolean;
}) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const result = await client.query(
    `INSERT INTO projects
     (id, organization_id, company_id, lead_id, audit_request_id, client_name, project_name,
      hourly_rate_cents, project_value_cents, legacy_sow_text, is_demo, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *`,
    [id, organizationId, input.companyId, input.leadId, input.auditRequestId, input.clientName.trim(), input.projectName.trim(),
     cents(input.hourlyRate), cents(input.projectValue), input.sowText.trim(), input.isDemo ?? false, createdAt]
  );
  const documentId = randomUUID();
  const versionId = randomUUID();

  await client.query(
    `INSERT INTO sow_documents (id, organization_id, project_id, title, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'Active',$5,$5)`,
    [documentId, organizationId, id, `${input.projectName.trim()} Statement of Work`, createdAt]
  );
  await client.query(
    `INSERT INTO sow_versions
     (id, organization_id, sow_document_id, version_number, source_type, content, content_sha256, created_at)
     VALUES ($1,$2,$3,1,'Pasted Text',$4,$5,$6)`,
    [versionId, organizationId, documentId, input.sowText.trim(), createHash("sha256").update(input.sowText.trim()).digest("hex"), createdAt]
  );

  for (const section of splitSowSections(input.sowText.trim())) {
    await client.query(
      `INSERT INTO sow_sections (id, organization_id, sow_version_id, heading, body, ordinal, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [randomUUID(), organizationId, versionId, section.heading, section.body, section.ordinal, createdAt]
    );
  }

  await client.query("UPDATE sow_documents SET current_version_id = $1 WHERE id = $2", [versionId, documentId]);
  await client.query(
    "UPDATE projects SET active_sow_version_id = $1 WHERE id = $2 AND organization_id = $3",
    [versionId, id, organizationId]
  );

  return mapProject({ ...result.rows[0], sow_text: input.sowText.trim() });
}

export async function createAuditRequest(input: {
  intake_token: string; client_name: string; project_value?: number | null; hourly_rate: number;
  sow_text: string; message_export_text: string; suspected_scope_creep_notes?: string | null;
}) {
  const publicOrganization = await publicOrganizationId();
  const preview = parseManualImport({ content: input.message_export_text, format: "Text" });

  return transaction(async (client) => {
    const organizationId = publicOrganization;
    const token = await client.query<DbRow>(
      `SELECT t.id AS token_id, l.*
       FROM audit_intake_tokens t
       JOIN leads l ON l.id=t.lead_id AND l.organization_id=t.organization_id
       WHERE t.organization_id=$1 AND t.token_sha256=$2
         AND t.consumed_at IS NULL AND t.expires_at > now()
       FOR UPDATE OF t, l`,
      [organizationId, auditIntakeTokenHash(input.intake_token)]
    );
    const lead = token.rows[0];

    if (!lead) throw new NotFoundError("Audit link is invalid or expired.");

    const leadId = String(lead.id);
    const companyId = lead.company_id
      ? String(lead.company_id)
      : await findOrCreateCompany(client, organizationId, input.client_name);
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const result = await client.query(
      `INSERT INTO audit_requests
       (id, organization_id, lead_id, company_id, client_name, project_value_cents, hourly_rate_cents,
        sow_text, message_export_text, suspected_scope_creep_notes, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Submitted',$11,$11) RETURNING *`,
      [id, organizationId, leadId, companyId, input.client_name.trim(), cents(input.project_value),
       cents(input.hourly_rate), input.sow_text.trim(), input.message_export_text.trim(),
       input.suspected_scope_creep_notes?.trim() || null, createdAt]
    );
    const project = await insertProjectAndSow(client, organizationId, {
      companyId, leadId, auditRequestId: id, clientName: input.client_name,
      projectName: `${input.client_name.trim()} Audit`, hourlyRate: input.hourly_rate,
      projectValue: input.project_value ?? null, sowText: input.sow_text
    });
    const importResult = await persistManualMessages(client, {
      organizationId,
      projectId: project.id,
      preview,
      actorUserId: null,
    });

    await client.query("UPDATE leads SET status = 'Audit Running', updated_at = now() WHERE id = $1 AND organization_id=$2", [leadId, organizationId]);
    await client.query(
      `INSERT INTO lead_status_history
       (id, organization_id, lead_id, from_status, to_status, note)
       VALUES ($1,$2,$3,$4,'Audit Running','Onboarding intake submitted.')`,
      [randomUUID(), organizationId, leadId, lead.status]
    );
    await client.query(
      "UPDATE audit_intake_tokens SET consumed_at=now() WHERE id=$1 AND organization_id=$2",
      [token.rows[0].token_id, organizationId]
    );

    return { auditRequest: mapAuditRequest(result.rows[0]), project, importResult };
  });
}

export async function createProject(input: {
  company_id?: string | null; lead_id?: string | null; audit_request_id?: string | null;
  client_name: string; project_name: string; hourly_rate: number; project_value?: number | null; sow_text: string;
}) {
  const context = await requireContext();

  return transaction((client) => insertProjectAndSow(client, context.organizationId, {
    companyId: input.company_id ?? null, leadId: input.lead_id ?? null, auditRequestId: input.audit_request_id ?? null,
    clientName: input.client_name, projectName: input.project_name, hourlyRate: input.hourly_rate,
    projectValue: input.project_value ?? null, sowText: input.sow_text
  }));
}

export async function getPublicIntakeAvailability() {
  const result = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM organization_settings
     WHERE COALESCE((settings->>'publicLeadCapture')::boolean, false) = true`,
  );

  return { enabled: Number(result.rows[0]?.count || 0) === 1 };
}

export async function getPublicIntakeSetting() {
  const context = await requireContext();
  const result = await query<{ enabled: boolean }>(
    `SELECT COALESCE((settings->>'publicLeadCapture')::boolean, false) AS enabled
     FROM organization_settings WHERE organization_id=$1`,
    [context.organizationId],
  );

  return Boolean(result.rows[0]?.enabled);
}

export async function setPublicIntakeSetting(enabled: boolean) {
  const context = await requireContext();

  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('scopeledger-public-intake'))");

    if (enabled) {
      const conflict = await client.query(
        `SELECT 1 FROM organization_settings
         WHERE organization_id<>$1
           AND COALESCE((settings->>'publicLeadCapture')::boolean, false) = true
         LIMIT 1`,
        [context.organizationId],
      );

      if (conflict.rows[0]) {
        throw new Error("Public audit intake is already enabled for another organization.");
      }
    }

    await client.query(
      `INSERT INTO organization_settings (organization_id, settings)
       VALUES ($1, jsonb_build_object('publicLeadCapture',$2::boolean))
       ON CONFLICT (organization_id) DO UPDATE
       SET settings=jsonb_set(organization_settings.settings,'{publicLeadCapture}',to_jsonb($2::boolean),true),
           updated_at=now()`,
      [context.organizationId, enabled],
    );
    await client.query(
      `INSERT INTO audit_logs
       (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata)
       VALUES ($1,$2,$3,'settings.public_intake.updated','organization',$2,$4::jsonb)`,
      [randomUUID(), context.organizationId, context.userId, JSON.stringify({ enabled })],
    );

    return enabled;
  });
}
