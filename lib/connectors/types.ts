import type { NormalizedCommunication } from "@/lib/ingestion/types";

export type ConnectorProvider = "Slack" | "Google" | "Microsoft";

export type ConnectorTestResult = {
  ok: boolean;
  accountLabel: string;
  details: string;
};

export type ConnectorSyncResult = {
  messages: Array<
    NormalizedCommunication & { deletedTimestamp?: string | null }
  >;
  checkpoint: Record<string, unknown>;
  warnings: string[];
};

export interface CommunicationConnector<Configuration> {
  provider: ConnectorProvider;
  test(
    configuration: Configuration,
    secrets: Record<string, string>,
  ): Promise<ConnectorTestResult>;
  sync(
    configuration: Configuration,
    secrets: Record<string, string>,
    checkpoint: Record<string, unknown>,
  ): Promise<ConnectorSyncResult>;
  revoke?(
    configuration: Configuration,
    secrets: Record<string, string>,
  ): Promise<void>;
}

export type ConnectorHttp = typeof fetch;
