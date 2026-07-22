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
  try {
    const workspace = await analysisWorkspace(id);
    return <AnalysisWorkspaceClient projectId={id} workspace={workspace} />;
  } catch (error) {
    if (error instanceof Error && error.message === "Project not found.")
      notFound();
    throw error;
  }
}
