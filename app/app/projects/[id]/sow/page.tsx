import Link from "next/link";
import { notFound } from "next/navigation";
import { SowWorkspaceClient } from "@/components/sow/SowWorkspaceClient";
import { Page, PageHeader } from "@/components/ui/Page";
import { currentAuthContext } from "@/lib/auth/current";
import { hasPermission } from "@/lib/auth/authorization";
import { getProjectDetail } from "@/lib/store";
import { getSowWorkspace } from "@/lib/sow/service";

export const dynamic = "force-dynamic";

export default async function SowWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [project, workspace, auth] = await Promise.all([getProjectDetail(id), getSowWorkspace(id), currentAuthContext()]);

  if (!project || !workspace) notFound();

  const canEdit = Boolean(auth && hasPermission(auth.role, "projects:write"));

  return (
    <Page>
      <PageHeader
        eyebrow={`${project.project.client_name} · ${project.project.project_name}`}
        title="Statement of Work"
        description="Version the governing agreement, review contractual risk, and approve the evidence map used for scope analysis. Nothing here is shared with the client."
        actions={<Link href={`/app/projects/${id}`} className="
          sl-button-secondary
        ">Back to project</Link>}
      />
      <div className="
        rounded-md border border-audit-amber/30 bg-audit-amber/5 p-4 text-sm/6
        text-audit-amber
      "><strong>Professional approval required.</strong> AI suggestions are a review aid, not legal advice or billing authorization. A new SOW version does not rewrite prior findings.</div>
      {query.created === "project" ? (
        <div className="
          rounded-md border border-signal/25 bg-signal/5 p-4 text-sm text-signal
        ">
          Project saved. Generate, review, and approve the boundary map before analyzing requests.
        </div>
      ) : null}
      <SowWorkspaceClient projectId={id} initialWorkspace={workspace} canEdit={canEdit} />
    </Page>
  );
}
