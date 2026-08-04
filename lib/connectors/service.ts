import { randomUUID } from "node:crypto";
import { z } from "zod";
import { currentAuthContext } from "@/lib/auth/current";
import { query, transaction } from "@/lib/db/client";
import {
  createGoogleConnector,
  googleConfigurationSchema,
} from "@/lib/connectors/google";
import {
  createMicrosoftConnector,
  microsoftConfigurationSchema,
} from "@/lib/connectors/microsoft";
import { refreshedAccessToken } from "@/lib/connectors/oauth";
import { persistConnectorSync } from "@/lib/connectors/persistence";
import {
  connectionSecrets,
  saveConnectionSecret,
} from "@/lib/connectors/secrets";
import {
  createSlackConnector,
  slackConfigurationSchema,
} from "@/lib/connectors/slack";
import type { ConnectorProvider } from "@/lib/connectors/types";

export type IntegrationConnection = {
  id: string;
  provider: string;
  name: string;
  status: string;
  configuration: Record<string, unknown>;
  last_error: string | null;
  last_synced_at: string | null;
  last_tested_at: string | null;
  connection_verified_at: string | null;
  sync_scope: string | null;
  data_permissions: unknown[];
  created_at: string;
  failed_jobs: number;
};
const configurationSchema = z.discriminatedUnion("provider", [
  slackConfigurationSchema.extend({ provider: z.literal("Slack") }),
  googleConfigurationSchema.extend({ provider: z.literal("Google") }),
  microsoftConfigurationSchema.extend({ provider: z.literal("Microsoft") }),
]);

async function auth() {
  const context = await currentAuthContext();

  if (!context) throw new Error("A valid organization session is required.");

  return context;
}

function connector(provider: ConnectorProvider) {
  if (provider === "Slack") return createSlackConnector();

  if (provider === "Google") return createGoogleConnector();

  return createMicrosoftConnector();
}

export async function listIntegrations() {
  const context = await auth();
  const result = await query<IntegrationConnection>(
    `SELECT c.id,c.provider,c.name,c.status,c.configuration,c.last_error,c.last_synced_at,c.last_tested_at,c.connection_verified_at,c.sync_scope,c.data_permissions,c.created_at,
            (SELECT count(*)::int FROM ingestion_jobs j WHERE j.organization_id=c.organization_id AND j.connection_id=c.id AND j.status='Failed') AS failed_jobs
     FROM communication_connections c WHERE c.organization_id=$1 ORDER BY c.provider,c.created_at`,
    [context.organizationId],
  );

  return result.rows.map((row) => ({
    ...row,
    configuration: {
      ...(row.configuration as Record<string, unknown>),
      clientId: (row.configuration as Record<string, unknown>)?.clientId
        ? "Saved"
        : undefined,
    },
  }));
}

export async function configurePlatformConnection(raw: unknown) {
  const context = await auth();
  const parsed = configurationSchema.parse(raw);
  const project = await query(
    "SELECT id FROM projects WHERE id=$1 AND organization_id=$2",
    [parsed.projectId, context.organizationId],
  );

  if (!project.rows[0]) throw new Error("Project not found.");

  const connectionId = randomUUID();
  const { provider, name, ...values } = parsed;
  const configuration = { ...values } as Record<string, unknown>;
  const secretName = provider === "Slack" ? "bot-token" : "client-secret";
  const secretValue =
    provider === "Slack" ? parsed.botToken : parsed.clientSecret;

  delete configuration.botToken;
  delete configuration.clientSecret;
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO communication_connections
       (id,organization_id,provider,name,status,configuration,sync_scope,data_permissions)
       VALUES ($1,$2,$3,$4,'Credentials Required',$5::jsonb,$6,$7::jsonb)`,
      [
        connectionId,
        context.organizationId,
        provider,
        name,
        JSON.stringify(configuration),
        provider === "Slack"
          ? `${parsed.channelIds.length} selected channel(s)`
          : provider === "Google"
            ? parsed.query || "Selected Gmail mailbox"
            : `Outlook ${parsed.mailboxFolder}; ${parsed.teamsChannels.length} Teams channel(s)`,
        JSON.stringify(
          provider === "Slack"
            ? ["Selected channel messages", "thread replies", "sender profiles"]
            : provider === "Google"
              ? ["Gmail message headers", "plain-text body", "labels"]
              : ["Outlook mail", "selected Teams channel messages"],
        ),
      ],
    );
    await saveConnectionSecret(
      client,
      context.organizationId,
      connectionId,
      secretName,
      secretValue,
    );
    await client.query(
      "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,'integration.configured','communication_connection',$4,$5::jsonb)",
      [
        randomUUID(),
        context.organizationId,
        context.userId,
        connectionId,
        JSON.stringify({ provider }),
      ],
    );
  });

  return {
    id: connectionId,
    provider,
    status: "Credentials Required" as const,
    requiresAuthorization: provider !== "Slack",
  };
}

async function connectionForUser(connectionId: string) {
  const context = await auth();
  const result = await query<{
    id: string;
    provider: ConnectorProvider;
    status: string;
    configuration: Record<string, unknown>;
  }>(
    "SELECT id,provider,status,configuration FROM communication_connections WHERE id=$1 AND organization_id=$2 AND provider IN ('Slack','Google','Microsoft')",
    [connectionId, context.organizationId],
  );

  if (!result.rows[0]) throw new Error("Platform connection not found.");

  if (result.rows[0].status === "Disabled")
    throw new Error(
      "This connection is disabled. Create a new configuration to reconnect.",
    );

  return { context, connection: result.rows[0] };
}

async function usableSecrets(
  organizationId: string,
  connection: {
    id: string;
    provider: ConnectorProvider;
    configuration: Record<string, unknown>;
  },
) {
  const secrets = await connectionSecrets(organizationId, connection.id);

  if (connection.provider === "Slack") return secrets;

  const accessToken = await refreshedAccessToken({
    provider: connection.provider,
    configuration: connection.configuration,
    secrets,
  });

  if (!accessToken)
    throw new Error(`${connection.provider} authorization is required.`);

  if (accessToken !== secrets["access-token"])
    await transaction((client) =>
      saveConnectionSecret(
        client,
        organizationId,
        connection.id,
        "access-token",
        accessToken,
      ),
    );

  return { ...secrets, "access-token": accessToken };
}

export async function testPlatformConnection(connectionId: string) {
  const { context, connection } = await connectionForUser(connectionId);

  try {
    const result = await connector(connection.provider).test(
      connection.configuration as never,
      await usableSecrets(context.organizationId, connection),
    );

    await query(
      "UPDATE communication_connections SET status='Connected',connection_verified_at=now(),last_tested_at=now(),last_error=NULL,updated_at=now() WHERE id=$1 AND organization_id=$2",
      [connectionId, context.organizationId],
    );

    return result;
  } catch {
    const message = `${connection.provider} connection test failed. Verify credentials, permissions, selected sources, and provider setup.`;

    await query(
      "UPDATE communication_connections SET status='Needs Attention',last_tested_at=now(),last_error=$1,updated_at=now() WHERE id=$2 AND organization_id=$3",
      [message, connectionId, context.organizationId],
    );
    throw new Error(message);
  }
}

export async function syncPlatformConnection(connectionId: string) {
  const { context, connection } = await connectionForUser(connectionId);

  if (connection.status !== "Connected")
    throw new Error("Test this connection successfully before syncing.");

  const jobId = randomUUID();

  await transaction(async (client) => {
    await client.query(
      "INSERT INTO ingestion_jobs (id,organization_id,connection_id,project_id,job_type,status,input,attempt_count,progress,max_attempts,started_at) VALUES ($1,$2,$3,$4,$5,'Running','{}'::jsonb,1,5,3,now())",
      [
        jobId,
        context.organizationId,
        connectionId,
        connection.configuration.projectId,
        `${connection.provider} Sync`,
      ],
    );
    await client.query(
      "UPDATE communication_connections SET status='Syncing',last_error=NULL,updated_at=now() WHERE id=$1 AND organization_id=$2",
      [connectionId, context.organizationId],
    );
  });

  try {
    const checkpoint = await query<{
      checkpoint_value: Record<string, unknown>;
    }>(
      "SELECT checkpoint_value FROM sync_checkpoints WHERE organization_id=$1 AND connection_id=$2 AND checkpoint_key='provider'",
      [context.organizationId, connectionId],
    );
    const providerResult = await connector(connection.provider).sync(
      connection.configuration as never,
      await usableSecrets(context.organizationId, connection),
      checkpoint.rows[0]?.checkpoint_value || {},
    );
    const oversized = providerResult.messages.filter(
      (message) => message.text.length > 100_000,
    ).length;
    const eligibleMessages = providerResult.messages.filter(
      (message) => message.text.length <= 100_000,
    );

    if (oversized)
      providerResult.warnings.push(
        `${oversized} provider message(s) over 100,000 characters were skipped.`,
      );

    return transaction(async (client) => {
      const persisted = await persistConnectorSync({
        client,
        organizationId: context.organizationId,
        connectionId,
        projectId: String(connection.configuration.projectId),
        provider: connection.provider,
        messages: eligibleMessages,
      });

      await client.query(
        `INSERT INTO sync_checkpoints (id,organization_id,connection_id,checkpoint_key,checkpoint_value)
         VALUES ($1,$2,$3,'provider',$4::jsonb)
         ON CONFLICT (organization_id,connection_id,checkpoint_key) DO UPDATE SET checkpoint_value=EXCLUDED.checkpoint_value,updated_at=now()`,
        [
          randomUUID(),
          context.organizationId,
          connectionId,
          JSON.stringify(providerResult.checkpoint),
        ],
      );
      const result = { ...persisted, warnings: providerResult.warnings };

      await client.query(
        "UPDATE ingestion_jobs SET status='Succeeded',progress=100,result=$1::jsonb,completed_at=now(),updated_at=now() WHERE id=$2 AND organization_id=$3",
        [JSON.stringify(result), jobId, context.organizationId],
      );
      await client.query(
        "UPDATE communication_connections SET status='Connected',last_synced_at=now(),last_error=NULL,updated_at=now() WHERE id=$1 AND organization_id=$2",
        [connectionId, context.organizationId],
      );

      return result;
    });
  } catch {
    const message = `${connection.provider} sync failed. Review the provider permissions, filters, and job diagnostics.`;

    await transaction(async (client) => {
      await client.query(
        "UPDATE ingestion_jobs SET status='Failed',error_message=$1,completed_at=now(),updated_at=now() WHERE id=$2 AND organization_id=$3",
        [message, jobId, context.organizationId],
      );
      await client.query(
        "UPDATE communication_connections SET status='Needs Attention',last_error=$1,updated_at=now() WHERE id=$2 AND organization_id=$3",
        [message, connectionId, context.organizationId],
      );
    });
    throw new Error(message);
  }
}

export async function disablePlatformConnection(connectionId: string) {
  const context = await auth();
  const result = await query<{
    id: string;
    provider: string;
    configuration: Record<string, unknown>;
  }>(
    "SELECT id,provider,configuration FROM communication_connections WHERE id=$1 AND organization_id=$2",
    [connectionId, context.organizationId],
  );
  const connection = result.rows[0];

  if (!connection) throw new Error("Connection not found.");

  if (connection.provider === "Google") {
    const secrets = await connectionSecrets(
      context.organizationId,
      connectionId,
    ).catch(() => ({}));

    await createGoogleConnector()
      .revoke?.(connection.configuration as never, secrets)
      .catch(() => undefined);
  }

  await transaction(async (client) => {
    await client.query(
      "DELETE FROM encrypted_secrets WHERE organization_id=$1 AND connection_id=$2",
      [context.organizationId, connectionId],
    );
    await client.query(
      "DELETE FROM sync_checkpoints WHERE organization_id=$1 AND connection_id=$2",
      [context.organizationId, connectionId],
    );
    await client.query(
      "UPDATE communication_connections SET status='Disabled',last_error=NULL,updated_at=now() WHERE id=$1 AND organization_id=$2",
      [connectionId, context.organizationId],
    );
    await client.query(
      "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,'integration.disabled','communication_connection',$4,$5::jsonb)",
      [
        randomUUID(),
        context.organizationId,
        context.userId,
        connectionId,
        JSON.stringify({ provider: connection.provider }),
      ],
    );
  });

  return { disabled: true };
}
