import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { currentAuthContext } from "@/lib/auth/current";
import { assertPermission } from "@/lib/auth/authorization";
import { query, transaction } from "@/lib/db/client";
import { providerJson } from "@/lib/connectors/http";
import {
  connectionSecrets,
  saveConnectionSecret,
} from "@/lib/connectors/secrets";
import type { ConnectorHttp, ConnectorProvider } from "@/lib/connectors/types";
import { decryptSecret, encryptSecret } from "@/lib/security/secrets";

type OAuthProvider = Extract<ConnectorProvider, "Google" | "Microsoft">;
type ConnectionRow = {
  id: string;
  organization_id: string;
  provider: OAuthProvider;
  configuration: Record<string, unknown>;
};

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive().optional(),
  token_type: z.string().optional(),
});

export function oauthProviderDefinition(
  provider: OAuthProvider,
  configuration: Record<string, unknown>,
) {
  if (provider === "Google")
    return {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.readonly",
      ],
    };

  const tenant = String(configuration.tenantId || "common");

  return {
    authorizeUrl: `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    scopes: [
      "offline_access",
      "User.Read",
      "Mail.Read",
      "ChannelMessage.Read.All",
    ],
  };
}

function verifierContext(organizationId: string, requestId: string) {
  return `${organizationId}:${requestId}:oauth-verifier`;
}

function base64Url(buffer: Buffer) {
  return buffer.toString("base64url");
}

export async function beginOAuthAuthorization(connectionId: string) {
  const auth = await currentAuthContext();

  if (!auth) throw new Error("A valid organization session is required.");

  assertPermission(auth.role, "integrations:write");
  const result = await query<ConnectionRow>(
    "SELECT id,organization_id,provider,configuration FROM communication_connections WHERE id=$1 AND organization_id=$2 AND provider IN ('Google','Microsoft') AND status<>'Disabled'",
    [connectionId, auth.organizationId],
  );
  const connection = result.rows[0];

  if (!connection) throw new Error("OAuth connection not found.");

  const clientId = String(connection.configuration.clientId || "");

  if (!clientId) throw new Error("OAuth client ID is missing.");

  const requestId = randomUUID();
  const state = base64Url(randomBytes(32));
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");

  if (!appUrl) throw new Error("APP_URL is required for OAuth callbacks.");

  const providerKey = connection.provider.toLowerCase();
  const redirectUri = `${appUrl}/api/integrations/oauth/${providerKey}/callback`;
  const encrypted = encryptSecret(
    verifier,
    verifierContext(auth.organizationId, requestId),
  );

  await query(
    `INSERT INTO oauth_authorization_requests (id,organization_id,connection_id,provider,state_sha256,verifier_ciphertext,verifier_initialization_vector,verifier_auth_tag,redirect_uri,expires_at,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+interval '10 minutes',$10)`,
    [
      requestId,
      auth.organizationId,
      connectionId,
      connection.provider,
      createHash("sha256").update(state).digest("hex"),
      encrypted.ciphertext,
      encrypted.initializationVector,
      encrypted.authTag,
      redirectUri,
      auth.userId,
    ],
  );
  const definition = oauthProviderDefinition(
    connection.provider,
    connection.configuration,
  );
  const url = new URL(definition.authorizeUrl);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", definition.scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  if (connection.provider === "Google") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
  }

  return { authorizationUrl: url.toString(), expiresInSeconds: 600 };
}

export async function completeOAuthAuthorization(input: {
  provider: OAuthProvider;
  state: string;
  code: string;
  fetcher?: ConnectorHttp;
}) {
  const auth = await currentAuthContext();

  if (!auth) throw new Error("Sign in before completing authorization.");

  assertPermission(auth.role, "integrations:write");
  const stateHash = createHash("sha256").update(input.state).digest("hex");
  const fetcher = input.fetcher || fetch;

  return transaction(async (client) => {
    const request = await client.query<{
      id: string;
      connection_id: string;
      redirect_uri: string;
      verifier_ciphertext: string;
      verifier_initialization_vector: string;
      verifier_auth_tag: string;
      configuration: Record<string, unknown>;
    }>(
      `SELECT r.*,c.configuration FROM oauth_authorization_requests r
       JOIN communication_connections c ON c.id=r.connection_id AND c.organization_id=r.organization_id
       WHERE r.organization_id=$1 AND r.provider=$2 AND r.state_sha256=$3 AND r.used_at IS NULL AND r.expires_at>now() AND c.status<>'Disabled' FOR UPDATE`,
      [auth.organizationId, input.provider, stateHash],
    );
    const row = request.rows[0];

    if (!row)
      throw new Error("OAuth request is invalid, expired, or already used.");

    const verifier = decryptSecret(
      {
        ciphertext: row.verifier_ciphertext,
        initializationVector: row.verifier_initialization_vector,
        authTag: row.verifier_auth_tag,
      },
      verifierContext(auth.organizationId, row.id),
    );
    const secrets = await connectionSecrets(
      auth.organizationId,
      row.connection_id,
      client,
    );
    const definition = oauthProviderDefinition(
      input.provider,
      row.configuration,
    );
    const body = new URLSearchParams({
      client_id: String(row.configuration.clientId || ""),
      client_secret: secrets["client-secret"] || "",
      code: input.code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: row.redirect_uri,
    });
    const { data } = await providerJson<unknown>(fetcher, definition.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const tokens = tokenSchema.parse(data);

    await saveConnectionSecret(
      client,
      auth.organizationId,
      row.connection_id,
      "access-token",
      tokens.access_token,
    );

    if (tokens.refresh_token)
      await saveConnectionSecret(
        client,
        auth.organizationId,
        row.connection_id,
        "refresh-token",
        tokens.refresh_token,
      );

    await client.query(
      "UPDATE oauth_authorization_requests SET used_at=now() WHERE id=$1 AND organization_id=$2",
      [row.id, auth.organizationId],
    );

    return { connectionId: row.connection_id };
  });
}

export async function refreshedAccessToken(input: {
  provider: OAuthProvider;
  configuration: Record<string, unknown>;
  secrets: Record<string, string>;
  fetcher?: ConnectorHttp;
}) {
  if (!input.secrets["refresh-token"])
    return input.secrets["access-token"] || "";

  const definition = oauthProviderDefinition(
    input.provider,
    input.configuration,
  );
  const body = new URLSearchParams({
    client_id: String(input.configuration.clientId || ""),
    client_secret: input.secrets["client-secret"] || "",
    refresh_token: input.secrets["refresh-token"],
    grant_type: "refresh_token",
  });
  const { data } = await providerJson<unknown>(
    input.fetcher || fetch,
    definition.tokenUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  return tokenSchema.parse(data).access_token;
}
