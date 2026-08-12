import { IntegrationHub } from "@/components/integrations/IntegrationHub";
import { Page, PageHeader } from "@/components/ui/Page";
import { requirePagePermission } from "@/lib/auth/current";
import { hasPermission } from "@/lib/auth/authorization";
import { listIntegrations } from "@/lib/connectors/service";
import { getAppDashboard } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const auth = await requirePagePermission("integrations:read");
  const [connections, dashboard, parameters] = await Promise.all([
    listIntegrations(),
    getAppDashboard(),
    searchParams,
  ]);

  return (
    <Page>
      <PageHeader eyebrow="Monitoring" title="Connections" description="Route selected client communications into a project. Saved configuration and verified provider connectivity are shown as distinct states. Imports never start analysis or contact a client." />
      <IntegrationHub
        initialConnections={connections}
        projects={dashboard.projects.map((project) => ({
          id: project.id,
          label: `${project.client_name} / ${project.project_name}`,
        }))}
        canManage={Boolean(
          auth && hasPermission(auth.role, "integrations:write"),
        )}
        oauthNotice={parameters.notice || null}
      />
    </Page>
  );
}
