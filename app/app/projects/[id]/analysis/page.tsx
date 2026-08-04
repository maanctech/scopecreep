import { notFound } from "next/navigation";
import { AnalysisWorkspaceClient } from "@/components/analysis/AnalysisWorkspaceClient";
import { analysisWorkspace } from "@/lib/analysisJobs/service";
import { requirePagePermission } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("findings:review");
  const { id } = await params;

  let workspace: Awaited<ReturnType<typeof analysisWorkspace>>;

  try {
    workspace = await analysisWorkspace(id);
  } catch (error) {
    if (error instanceof Error && error.message === "Project not found.")
      notFound();

    throw error;
  }

  return <AnalysisWorkspaceClient projectId={id} workspace={workspace} />;
}
