"use client";

export function ConnectionForm({
  projects,
  canManage,
  provider,
  busy,
  onProviderChange,
  onSubmit,
}: {
  projects: Array<{ id: string; label: string }>;
  canManage: boolean;
  provider: string;
  busy: string | null;
  onProviderChange: (provider: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  if (!canManage)
    return (
      <p className="rounded-md border border-audit-border bg-white p-5 text-sm">
        Your role can review connection health but cannot change credentials
        or run syncs.
      </p>
    );

  return (
    <section className="
      rounded-md border border-audit-border bg-white p-6 shadow-audit
    ">
      <h2 className="text-xl font-semibold">Configure a connection</h2>
      <p className="mt-2 text-sm text-zinc-700">
        Credentials are encrypted before storage and are never returned.
        Google and Microsoft also require an app registration and OAuth
        approval.
      </p>
      {projects.length ? (
        <form
          onSubmit={onSubmit}
          autoComplete="off"
          className="
            mt-5 grid gap-4
            md:grid-cols-2
          "
        >
          <label>
            <span className="text-sm font-medium">Method</span>
            <select
              value={provider}
              onChange={(event) => onProviderChange(event.target.value)}
              className="mt-2 w-full rounded-md border border-audit-border p-3"
            >
              <option>Slack</option>
              <option value="Google">Google Gmail</option>
              <option value="Microsoft">Microsoft 365</option>
              <option>IMAP</option>
              <option>Webhook</option>
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">Project route</span>
            <select
              name="projectId"
              required
              className="mt-2 w-full rounded-md border border-audit-border p-3"
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">Connection name</span>
            <input
              name="name"
              required
              autoComplete="off"
              className="mt-2 w-full rounded-md border border-audit-border p-3"
            />
          </label>
          {provider === "IMAP" ? (
            <>
              <label>
                <span className="text-sm font-medium">IMAP host</span>
                <input
                  name="host"
                  required
                  className="
                    mt-2 w-full rounded-md border border-audit-border p-3
                  "
                />
              </label>
              <label>
                <span className="text-sm font-medium">Port</span>
                <input
                  name="port"
                  type="number"
                  defaultValue="993"
                  required
                  className="
                    mt-2 w-full rounded-md border border-audit-border p-3
                  "
                />
              </label>
              <label>
                <span className="text-sm font-medium">Username</span>
                <input
                  name="username"
                  required
                  autoComplete="off"
                  className="
                    mt-2 w-full rounded-md border border-audit-border p-3
                  "
                />
              </label>
              <label>
                <span className="text-sm font-medium">Password</span>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="
                    mt-2 w-full rounded-md border border-audit-border p-3
                  "
                />
              </label>
              <label>
                <span className="text-sm font-medium">Folder</span>
                <input
                  name="folder"
                  defaultValue="INBOX"
                  required
                  className="
                    mt-2 w-full rounded-md border border-audit-border p-3
                  "
                />
              </label>
            </>
          ) : null}
          {["Google", "Microsoft"].includes(provider) ? (
            <label>
              <span className="text-sm font-medium">OAuth client ID</span>
              <input
                name="clientId"
                required
                autoComplete="off"
                className="
                  mt-2 w-full rounded-md border border-audit-border p-3
                "
              />
            </label>
          ) : null}
          {["Slack", "Google", "Microsoft"].includes(provider) ? (
            <label>
              <span className="text-sm font-medium">
                {provider === "Slack" ? "Bot token" : "OAuth client secret"}
              </span>
              <input
                name="credential"
                type="password"
                required
                autoComplete="new-password"
                className="
                  mt-2 w-full rounded-md border border-audit-border p-3
                "
              />
            </label>
          ) : null}
          {provider === "Google" ? (
            <label className="md:col-span-2">
              <span className="text-sm font-medium">
                Gmail label IDs, comma-separated (optional)
              </span>
              <input
                name="labelIds"
                className="
                  mt-2 w-full rounded-md border border-audit-border p-3
                "
              />
            </label>
          ) : null}
          {provider === "Microsoft" ? (
            <label className="md:col-span-2">
              <span className="text-sm font-medium">
                Teams channels (optional, one team ID | channel ID | label
                per line)
              </span>
              <textarea
                name="teamsChannels"
                rows={3}
                placeholder="team-id | channel-id | Client delivery"
                className="
                  mt-2 w-full rounded-md border border-audit-border p-3
                "
              />
            </label>
          ) : null}
          {provider === "Microsoft" ? (
            <label>
              <span className="text-sm font-medium">Tenant ID</span>
              <input
                name="tenantId"
                defaultValue="common"
                required
                className="
                  mt-2 w-full rounded-md border border-audit-border p-3
                "
              />
            </label>
          ) : null}
          {["Slack", "Google", "Microsoft"].includes(provider) ? (
            <label className="md:col-span-2">
              <span className="text-sm font-medium">
                {provider === "Slack"
                  ? "Channel IDs, comma-separated"
                  : provider === "Google"
                    ? "Gmail search filter"
                    : "Outlook folder"}
              </span>
              <input
                name="scope"
                required={provider === "Slack"}
                defaultValue={provider === "Microsoft" ? "inbox" : ""}
                className="
                  mt-2 w-full rounded-md border border-audit-border p-3
                "
              />
            </label>
          ) : null}
          {["Slack", "Google", "Microsoft", "IMAP"].includes(provider) ? (
            <label className="md:col-span-2">
              <span className="text-sm font-medium">
                Excluded internal sender domains, comma-separated
              </span>
              <input
                name="domains"
                placeholder="yourfirm.com"
                className="
                  mt-2 w-full rounded-md border border-audit-border p-3
                "
              />
            </label>
          ) : null}
          <button
            disabled={Boolean(busy)}
            className="
              min-h-11 rounded-md bg-ink px-5 text-sm font-semibold text-white
              disabled:opacity-60
              md:col-span-2
            "
          >
            {busy === "configure"
              ? "Saving securely..."
              : "Save configuration"}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-zinc-700">
          Create a project before configuring a source route.
        </p>
      )}
    </section>
  );
}
