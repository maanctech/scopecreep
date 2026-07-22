import { IntegrationHub } from "@/components/integrations/IntegrationHub";
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
    <div className="space-y-8">
      <section className="border-b border-audit-border pb-7">
        <p className="text-sm font-medium text-audit-muted">
          Private source connections
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Integration Hub</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-700">
          Route selected client communications into a project. A saved setup is
          not called connected until ScopeLedger completes a real provider test.
          Imports never start analysis or contact a client automatically.
        </p>
      </section>
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
    </div>
  );
}
