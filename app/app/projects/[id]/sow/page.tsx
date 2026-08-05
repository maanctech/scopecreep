import Link from "next/link";
import { notFound } from "next/navigation";
import { SowWorkspaceClient } from "@/components/sow/SowWorkspaceClient";
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
    <div className="space-y-8">
      <section className="border-b border-audit-border pb-7">
        <Link href={`/app/projects/${id}`} className="
          text-sm font-medium text-zinc-700 underline
        ">Back to project</Link>
        <p className="mt-5 text-sm text-audit-muted">{project.project.client_name} / {project.project.project_name}</p>
        <h1 className="mt-2 text-3xl font-semibold">Statement of Work workspace</h1>
        <p className="mt-3 max-w-3xl text-base/7 text-zinc-700">Keep agreement versions, review contractual risk, and approve the boundary map used for scope analysis. Nothing here is shared with the client.</p>
      </section>
      <div className="
        rounded-md border border-amber-300 bg-amber-50 p-4 text-sm/6
        text-amber-950
      "><strong>Professional approval required.</strong> AI suggestions are a review aid, not legal advice or billing authorization. A new SOW version does not rewrite prior findings.</div>
      {query.created === "project" ? (
        <div className="
          rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm
          text-emerald-900
        ">
          Project saved. Generate, review, and approve the boundary map before analyzing requests.
        </div>
      ) : null}
      <SowWorkspaceClient projectId={id} initialWorkspace={workspace} canEdit={canEdit} />
    </div>
  );
}
