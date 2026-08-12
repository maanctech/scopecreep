import type { DashboardFinding } from "@/lib/store/postgres/loaders";
import type { Project, ProjectSummary } from "@/lib/types";

/**
 * Findings arrive newest first, so the first one seen for a message is the one
 * that message currently reports. The JavaScript join used to express this by
 * overwriting a map entry; it is explicit here because every project total on
 * both dashboards depends on it.
 */
function newestFindingPerMessage(findings: DashboardFinding[]) {
  const byMessage = new Map<string, DashboardFinding>();

  for (const finding of findings) {
    if (!byMessage.has(finding.client_message_id)) byMessage.set(finding.client_message_id, finding);
  }

  return [...byMessage.values()];
}

export function summariseProjects(projects: Project[], findings: DashboardFinding[]): ProjectSummary[] {
  const current = newestFindingPerMessage(findings);
  const byProject = new Map<string, DashboardFinding[]>();

  for (const finding of current) {
    byProject.set(finding.project_id, [...byProject.get(finding.project_id) ?? [], finding]);
  }

  return projects.map((project) => {
    const own = byProject.get(project.id) ?? [];

    return {
      ...project,
      messages_analyzed: own.length,
      out_of_scope_count: own.filter((finding) => finding.classification === "Out of Scope").length,
      potential_recovered_revenue: own.reduce(
        (sum, finding) => sum + (finding.classification !== "In Scope" ? finding.estimated_revenue : 0), 0
      )
    };
  });
}
