import Link from "next/link";

type ApprovedContext = {
  sowVersionId: string;
  boundaryMapId: string;
  boundaryItemCount: number;
} | null;

export function WorkspaceOverview({
  projectId,
  approvedContext,
  boundaryError,
  notice,
}: {
  projectId: string;
  approvedContext: ApprovedContext;
  boundaryError: string | null;
  notice: { error?: string; success?: string };
}) {
  return (
    <>
      <section className="border-b border-audit-border pb-7">
        <p className="text-sm font-medium text-audit-muted">
          Controlled scope comparison
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Analyze communications</h1>
        <p className="mt-3 max-w-3xl text-base/7 text-zinc-700">
          Select only the client communications you want compared with the
          approved agreement. AI creates private draft findings; it never makes
          a billing decision or contacts a client.
        </p>
        <Link
          href={`/app/projects/${projectId}`}
          className="
            mt-4 inline-flex min-h-11 items-center text-sm font-semibold
            underline
          "
        >
          Return to project
        </Link>
      </section>

      {approvedContext ? (
        <div className="
          rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm
          text-emerald-950
        ">
          Approved boundary map ready with{" "}
          {approvedContext.boundaryItemCount} evidence-linked items. Every job
          is pinned to this map and its SOW version.
        </div>
      ) : (
        <div
          role="alert"
          className="
            rounded-md border border-amber-300 bg-amber-50 p-5 text-amber-950
          "
        >
          <p className="font-semibold">Agreement approval required</p>
          <p className="mt-2 text-sm">{boundaryError}</p>
          <Link
            href={`/app/projects/${projectId}/sow`}
            className="
              mt-3 inline-flex min-h-11 items-center text-sm font-semibold
              underline
            "
          >
            Review and approve the SOW boundary map
          </Link>
        </div>
      )}

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
    </>
  );
}
