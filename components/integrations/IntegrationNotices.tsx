type Notice = { error?: string; success?: string };

export function IntegrationNotices({
  notice,
  oneTimeSecret,
}: {
  notice: Notice;
  oneTimeSecret: { endpoint: string; secret: string } | null;
}) {
  return (
    <>
      {notice.error ? (
        <div
          role="alert"
          className="
            rounded-md border border-critical/25 bg-critical/5 p-4 text-critical
          "
        >
          {notice.error}
        </div>
      ) : null}
      {notice.success ? (
        <div
          role="status"
          className="
            rounded-md border border-signal/25 bg-signal/5 p-4 text-signal
          "
        >
          {notice.success}
        </div>
      ) : null}
      {oneTimeSecret ? (
        <section className="
          rounded-md border-2 border-audit-amber/30 bg-audit-amber/5 p-5
        ">
          <h2 className="text-lg font-semibold">One-time webhook secret</h2>
          <p className="mt-2 text-sm text-audit-amber">
            This value will not be shown again. Store it in the sending
            system&apos;s secret manager.
          </p>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="font-semibold">Endpoint</dt>
              <dd className="mt-1 font-mono break-all">
                {oneTimeSecret.endpoint}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Signing secret</dt>
              <dd className="mt-1 font-mono break-all">
                {oneTimeSecret.secret}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
    </>
  );
}
