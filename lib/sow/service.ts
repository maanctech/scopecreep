import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { withAuthenticatedTenant } from "@/lib/auth/scope";
import { query, transaction } from "@/lib/db/client";
import { analyzeSowForReview } from "@/lib/sow/analysis";
import { splitSowSections, type ExtractedSow } from "@/lib/sow/extraction";
import type { BoundaryItem, BoundaryType, RiskItem, SowSection, SowVersion, SowWorkspace } from "@/lib/sow/types";

type Row = Record<string, unknown>;

const iso = (value: unknown) => value instanceof Date ? value.toISOString() : String(value);

function mapVersion(row: Row, activeId: string | null): SowVersion {
  return { id: String(row.id), versionNumber: Number(row.version_number), sourceType: String(row.source_type), sourceFilename: row.source_filename ? String(row.source_filename) : null, content: String(row.content), contentHash: String(row.content_sha256), changeNote: row.change_note ? String(row.change_note) : null, extractionStatus: row.extraction_status as SowVersion["extractionStatus"], extractionWarning: row.extraction_warning ? String(row.extraction_warning) : null, createdAt: iso(row.created_at), isActive: String(row.id) === activeId };
}

export async function getSowWorkspace(projectId: string): Promise<SowWorkspace | null> {
  return withAuthenticatedTenant(async (auth) => {
    const project = await query<Row>("SELECT active_sow_version_id, active_boundary_map_id FROM projects WHERE id=$1 AND organization_id=$2", [projectId, auth.organizationId]);

    if (!project.rows[0]) return null;

    const activeVersionId = project.rows[0].active_sow_version_id ? String(project.rows[0].active_sow_version_id) : null;
    const documents = await query<Row>("SELECT * FROM sow_documents WHERE project_id=$1 AND organization_id=$2 ORDER BY created_at LIMIT 1", [projectId, auth.organizationId]);
    const document = documents.rows[0];

    if (!document) return { document: null, versions: [], activeVersion: null, sections: [], boundaryMap: null, riskReview: null };

    const versionsResult = await query<Row>("SELECT * FROM sow_versions WHERE sow_document_id=$1 AND organization_id=$2 ORDER BY version_number DESC", [document.id, auth.organizationId]);
    const versions = versionsResult.rows.map((row) => mapVersion(row, activeVersionId));
    const effectiveActive = activeVersionId || (document.current_version_id ? String(document.current_version_id) : null);
    const activeVersion = versions.find((item) => item.id === effectiveActive) ?? null;
    const sectionsResult = activeVersion ? await query<Row>("SELECT * FROM sow_sections WHERE sow_version_id=$1 AND organization_id=$2 ORDER BY ordinal", [activeVersion.id, auth.organizationId]) : { rows: [] as Row[] };
    const sections: SowSection[] = sectionsResult.rows.map((row) => ({ id: String(row.id), heading: row.heading ? String(row.heading) : null, body: String(row.body), ordinal: Number(row.ordinal) }));

    const maps = await query<Row>("SELECT * FROM scope_boundary_maps WHERE project_id=$1 AND organization_id=$2 AND sow_version_id=$3 ORDER BY (status='Active') DESC, created_at DESC LIMIT 1", [projectId, auth.organizationId, effectiveActive]);
    const map = maps.rows[0];
    const mapItems = map ? await query<Row>("SELECT * FROM scope_boundary_items WHERE boundary_map_id=$1 AND organization_id=$2 ORDER BY ordinal", [map.id, auth.organizationId]) : { rows: [] as Row[] };
    const boundaryMap = map ? { id: String(map.id), name: String(map.name), status: map.status as "Draft" | "Active" | "Archived", approvedAt: map.approved_at ? iso(map.approved_at) : null, items: mapItems.rows.map((row): BoundaryItem => ({ id: String(row.id), boundaryType: row.boundary_type as BoundaryType, category: String(row.category), description: String(row.description), evidence: String(row.evidence || ""), ordinal: Number(row.ordinal) })) } : null;

    const reviews = await query<Row>("SELECT * FROM sow_risk_reviews WHERE sow_version_id=$1 AND organization_id=$2 ORDER BY created_at DESC LIMIT 1", [effectiveActive, auth.organizationId]);
    const review = reviews.rows[0];
    const riskItemsResult = review ? await query<Row>("SELECT * FROM sow_risk_items WHERE risk_review_id=$1 AND organization_id=$2 ORDER BY ordinal", [review.id, auth.organizationId]) : { rows: [] as Row[] };
    const riskReview = review ? { id: String(review.id), status: review.status as "Draft" | "Reviewed", summary: String(review.summary), provider: String(review.provider), model: String(review.model), items: riskItemsResult.rows.map((row): RiskItem => ({ id: String(row.id), severity: row.severity as RiskItem["severity"], category: String(row.category), description: String(row.description), recommendation: String(row.recommendation), evidence: String(row.evidence) })) } : null;

    return { document: { id: String(document.id), title: String(document.title) }, versions, activeVersion, sections, boundaryMap, riskReview };
  });
}

export async function createSowVersion(input: { projectId: string; text: string; changeNote?: string | null; extracted?: ExtractedSow; fileBuffer?: Buffer }) {
  return withAuthenticatedTenant(async (auth) => {
    const content = input.text.replace(/\0/g, "").trim();

    if (content.length < 40) throw new Error("Provide at least 40 characters of SOW text.");

    if (content.length > 500_000) throw new Error("SOW text must be 500,000 characters or less.");

    const versionId = randomUUID();
    let storagePath: string | null = null;

    if (input.extracted && input.fileBuffer) {
      const root = path.resolve(process.env.SCOPELEDGER_DOCUMENT_DIR || path.join(process.cwd(), "data", "documents"));
      const directory = path.join(root, auth.organizationId, input.projectId);

      await mkdir(directory, { recursive: true, mode: 0o700 });
      const finalPath = path.join(directory, `${versionId}-${input.extracted.safeFilename}`);
      const temporaryPath = `${finalPath}.tmp-${randomUUID()}`;

      await writeFile(temporaryPath, input.fileBuffer, { mode: 0o600 });
      await rename(temporaryPath, finalPath);
      storagePath = path.relative(root, finalPath);
    }

    try {
      return await transaction(async (client) => {
        const project = await client.query<Row>("SELECT * FROM projects WHERE id=$1 AND organization_id=$2 FOR UPDATE", [input.projectId, auth.organizationId]);

        if (!project.rows[0]) throw new Error("Project not found.");

        const document = await client.query<Row>("SELECT * FROM sow_documents WHERE project_id=$1 AND organization_id=$2 ORDER BY created_at LIMIT 1 FOR UPDATE", [input.projectId, auth.organizationId]);
        const documentId = document.rows[0] ? String(document.rows[0].id) : randomUUID();

        if (!document.rows[0]) await client.query("INSERT INTO sow_documents (id,organization_id,project_id,title,status,created_by) VALUES ($1,$2,$3,$4,'Active',$5)", [documentId, auth.organizationId, input.projectId, `${project.rows[0].project_name} Statement of Work`, auth.userId]);

        const next = await client.query<{ value: number }>("SELECT COALESCE(MAX(version_number),0)+1 AS value FROM sow_versions WHERE sow_document_id=$1 AND organization_id=$2", [documentId, auth.organizationId]);
        const versionNumber = Number(next.rows[0].value);

        await client.query(`INSERT INTO sow_versions (id,organization_id,sow_document_id,version_number,source_type,content,content_sha256,change_note,created_by,source_filename,media_type,byte_size,storage_path,extraction_status,extraction_warning) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Succeeded',$14)`, [versionId, auth.organizationId, documentId, versionNumber, input.extracted?.sourceType || "Pasted Text", content, createHash("sha256").update(content).digest("hex"), input.changeNote?.trim() || null, auth.userId, input.extracted?.safeFilename || null, input.extracted?.mediaType || null, input.fileBuffer?.length || null, storagePath, input.extracted?.warning || null]);

        for (const section of splitSowSections(content)) await client.query("INSERT INTO sow_sections (id,organization_id,sow_version_id,heading,body,ordinal) VALUES ($1,$2,$3,$4,$5,$6)", [randomUUID(), auth.organizationId, versionId, section.heading, section.body, section.ordinal]);

        await client.query("UPDATE sow_documents SET current_version_id=$1,updated_at=now() WHERE id=$2 AND organization_id=$3", [versionId, documentId, auth.organizationId]);
        await client.query("UPDATE scope_boundary_maps SET status='Archived',updated_at=now() WHERE project_id=$1 AND organization_id=$2 AND status='Active'", [input.projectId, auth.organizationId]);
        await client.query("UPDATE projects SET active_sow_version_id=$1,active_boundary_map_id=NULL,legacy_sow_text=$2,updated_at=now() WHERE id=$3 AND organization_id=$4", [versionId, content, input.projectId, auth.organizationId]);
        await client.query("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,'sow.version.created','sow_version',$4,$5::jsonb)", [randomUUID(), auth.organizationId, auth.userId, versionId, JSON.stringify({ projectId: input.projectId, versionNumber, sourceType: input.extracted?.sourceType || "Pasted Text" })]);

        return { versionId, versionNumber };
      });
    } catch (error) {
      if (storagePath) {
        const root = path.resolve(process.env.SCOPELEDGER_DOCUMENT_DIR || path.join(process.cwd(), "data", "documents"));

        await rm(path.join(root, storagePath), { force: true }).catch(() => undefined);
      }

      throw error;
    }
  });
}

export async function generateSowReview(projectId: string) {
  return withAuthenticatedTenant(async (auth) => {
    const workspace = await getSowWorkspace(projectId);

    if (!workspace?.activeVersion) throw new Error("Add an active SOW version first.");

    const analyzed = await analyzeSowForReview(workspace.activeVersion.content);

    return transaction(async (client) => {
      await client.query("UPDATE scope_boundary_maps SET status='Archived',updated_at=now() WHERE project_id=$1 AND organization_id=$2 AND status='Draft'", [projectId, auth.organizationId]);
      const mapId = randomUUID();

      await client.query("INSERT INTO scope_boundary_maps (id,organization_id,project_id,sow_version_id,name,status,created_by) VALUES ($1,$2,$3,$4,$5,'Draft',$6)", [mapId, auth.organizationId, projectId, workspace.activeVersion!.id, `Scope Boundary Map v${workspace.activeVersion!.versionNumber}`, auth.userId]);

      for (const [ordinal, item] of analyzed.review.boundary_items.entries()) await client.query("INSERT INTO scope_boundary_items (id,organization_id,boundary_map_id,boundary_type,category,description,evidence,ordinal) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [randomUUID(), auth.organizationId, mapId, item.boundary_type, item.category, item.description, item.evidence, ordinal]);

      const reviewId = randomUUID();

      await client.query("INSERT INTO sow_risk_reviews (id,organization_id,project_id,sow_version_id,provider,model,prompt_version,status,summary,latency_ms,input_character_count,output_character_count,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,'Draft',$8,$9,$10,$11,$12)", [reviewId, auth.organizationId, projectId, workspace.activeVersion!.id, analyzed.metadata.provider, analyzed.metadata.model, analyzed.metadata.promptVersion, analyzed.review.summary, analyzed.metadata.latencyMs, analyzed.metadata.inputCharacters, analyzed.metadata.outputCharacters, auth.userId]);

      for (const [ordinal, item] of analyzed.review.risk_items.entries()) await client.query("INSERT INTO sow_risk_items (id,organization_id,risk_review_id,severity,category,description,recommendation,evidence,ordinal) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [randomUUID(), auth.organizationId, reviewId, item.severity, item.category, item.description, item.recommendation, item.evidence, ordinal]);

      await client.query("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,'sow.review.generated','scope_boundary_map',$4,$5::jsonb)", [randomUUID(), auth.organizationId, auth.userId, mapId, JSON.stringify({ projectId, sowVersionId: workspace.activeVersion!.id, provider: analyzed.metadata.provider, model: analyzed.metadata.model })]);

      return { mapId, reviewId };
    });
  });
}

export async function saveBoundaryMap(input: { projectId: string; mapId: string; items: Array<{ boundaryType: BoundaryType; category: string; description: string; evidence: string }>; approve: boolean }) {
  return withAuthenticatedTenant(async (auth) => {

    if (!input.items.length) throw new Error("A boundary map must contain at least one item.");

    return transaction(async (client) => {
      const map = await client.query<Row>("SELECT * FROM scope_boundary_maps WHERE id=$1 AND project_id=$2 AND organization_id=$3 FOR UPDATE", [input.mapId, input.projectId, auth.organizationId]);

      if (!map.rows[0] || map.rows[0].status === "Archived") throw new Error("Boundary map not found or no longer editable.");

      await client.query("DELETE FROM scope_boundary_items WHERE boundary_map_id=$1 AND organization_id=$2", [input.mapId, auth.organizationId]);

      for (const [ordinal, item] of input.items.entries()) await client.query("INSERT INTO scope_boundary_items (id,organization_id,boundary_map_id,boundary_type,category,description,evidence,ordinal) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [randomUUID(), auth.organizationId, input.mapId, item.boundaryType, item.category.trim(), item.description.trim(), item.evidence.trim(), ordinal]);

      if (input.approve) {
        await client.query("UPDATE scope_boundary_maps SET status='Archived',updated_at=now() WHERE project_id=$1 AND organization_id=$2 AND status='Active' AND id<>$3", [input.projectId, auth.organizationId, input.mapId]);
        await client.query("UPDATE scope_boundary_maps SET status='Active',approved_by=$1,approved_at=now(),updated_at=now() WHERE id=$2 AND organization_id=$3", [auth.userId, input.mapId, auth.organizationId]);
        await client.query("UPDATE projects SET active_boundary_map_id=$1,active_sow_version_id=$2,updated_at=now() WHERE id=$3 AND organization_id=$4", [input.mapId, map.rows[0].sow_version_id, input.projectId, auth.organizationId]);
        await client.query("UPDATE sow_risk_reviews SET status='Reviewed',reviewed_by=$1,reviewed_at=now(),updated_at=now() WHERE sow_version_id=$2 AND organization_id=$3 AND status='Draft'", [auth.userId, map.rows[0].sow_version_id, auth.organizationId]);
      }

      await client.query("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,$4,'scope_boundary_map',$5,$6::jsonb)", [randomUUID(), auth.organizationId, auth.userId, input.approve ? "sow.boundary.approved" : "sow.boundary.updated", input.mapId, JSON.stringify({ projectId: input.projectId, itemCount: input.items.length })]);

      return { approved: input.approve };
    });
  });
}
