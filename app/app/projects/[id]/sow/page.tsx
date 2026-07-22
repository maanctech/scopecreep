import Link from "next/link";
import { notFound } from "next/navigation";
import { SowWorkspaceClient } from "@/components/sow/SowWorkspaceClient";
import { currentAuthContext } from "@/lib/auth/current";
import { hasPermission } from "@/lib/auth/authorization";
import { getProjectDetail } from "@/lib/store";
import { getSowWorkspace } from "@/lib/sow/service";

export const dynamic = "force-dynamic";

export default async function SowWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, workspace, auth] = await Promise.all([getProjectDetail(id), getSowWorkspace(id), currentAuthContext()]);
  if (!project || !workspace) notFound();
  const canEdit = Boolean(auth && hasPermission(auth.role, "projects:write"));
  return (
    <div className="space-y-8">
      <section className="border-b border-audit-border pb-7">
        <Link href={`/app/projects/${id}`} className="text-sm font-medium text-zinc-700 underline">Back to project</Link>
        <p className="mt-5 text-sm text-audit-muted">{project.project.client_name} / {project.project.project_name}</p>
        <h1 className="mt-2 text-3xl font-semibold">Statement of Work workspace</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-700">Keep agreement versions, review contractual risk, and approve the boundary map used for scope analysis. Nothing here is shared with the client.</p>
      </section>
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Professional approval required.</strong> AI suggestions are a review aid, not legal advice or billing authorization. A new SOW version does not rewrite prior findings.</div>
      <SowWorkspaceClient projectId={id} initialWorkspace={workspace} canEdit={canEdit} />
    </div>
  );
}
