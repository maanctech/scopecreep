import Link from "next/link";

const catalog = [
  ["Manual Import", "Paste or upload text, CSV, and JSON", "Available"],
  [
    "Transcript Import",
    "Upload VTT, SRT, or pasted transcript cues",
    "Available",
  ],
  [
    "Signed Webhook",
    "Send normalized JSON through an HMAC-signed endpoint",
    "Available",
  ],
  [
    "IMAP Email",
    "Read a routed mailbox or folder over TLS",
    "Bring Your Own Credentials",
  ],
  [
    "Slack",
    "Read selected channels and thread replies",
    "Bring Your Own Credentials",
  ],
  [
    "Google Gmail",
    "Read a filtered mailbox with OAuth",
    "Bring Your Own Credentials",
  ],
  [
    "Microsoft 365",
    "Read Outlook and selected Teams channels with OAuth",
    "Bring Your Own Credentials",
  ],
] as const;

export function IntegrationCatalog() {
  return (
    <section>
      <h2 className="text-xl font-semibold">Connection methods</h2>
      <div className="
        mt-4 grid gap-4
        md:grid-cols-2
        xl:grid-cols-3
      ">
        {catalog.map(([name, purpose, availability]) => (
          <article
            key={name}
            className="sl-panel p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{name}</h3>
              <span className="text-xs font-semibold text-audit-muted">
                {availability}
              </span>
            </div>
            <p className="mt-2 text-sm/6 text-audit-body">{purpose}</p>
            {name.includes("Import") ? (
              <Link
                href="/app/import"
                className="
                  mt-4 inline-flex min-h-11 items-center text-sm font-semibold
                  underline
                "
              >
                Open import
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
