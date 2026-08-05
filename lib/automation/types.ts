export type AutomationStatus = "Active" | "Paused" | "Needs Attention";

export type ProjectAutomation = {
  id: string;
  organization_id: string;
  project_id: string;
  status: AutomationStatus;
  sync_interval_minutes: number;
  next_run_at: string | null;
  last_started_at: string | null;
  last_succeeded_at: string | null;
  last_error: string | null;
  enabled_by_user_id: string | null;
  version: number;
  running: boolean;
  connected_sources: number;
};

export type ClaimedAutomationRun = {
  runId: string;
  organizationId: string;
  projectId: string;
  actorUserId: string;
  leaseOwner: string;
};

export type ConnectorSyncSummary = {
  insertedMessageIds: string[];
  changedMessageIds?: string[];
};
