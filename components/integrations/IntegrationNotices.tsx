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
            rounded-md border border-red-300 bg-red-50 p-4 text-red-900
          "
        >
          {notice.error}
        </div>
      ) : null}
      {notice.success ? (
        <div
          role="status"
          className="
            rounded-md border border-emerald-300 bg-emerald-50 p-4
            text-emerald-900
          "
        >
          {notice.success}
        </div>
      ) : null}
      {oneTimeSecret ? (
        <section className="
          rounded-md border-2 border-amber-400 bg-amber-50 p-5
        ">
          <h2 className="text-lg font-semibold">One-time webhook secret</h2>
          <p className="mt-2 text-sm text-amber-950">
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
