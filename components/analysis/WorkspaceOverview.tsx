import Link from "next/link";
import { PageHeader } from "@/components/ui/Page";

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
      <PageHeader
        eyebrow="Controlled scope comparison"
        title="Analyze communications"
        description="Select only the client communications you want compared with the approved agreement. AI creates private draft findings; it never makes a billing decision or contacts a client."
        actions={<Link href={`/app/projects/${projectId}`} className="
          sl-button-secondary
        ">Return to project</Link>}
      />

      {approvedContext ? (
        <div className="
          rounded-md border border-signal/25 bg-signal/5 p-4 text-sm text-signal
        ">
          Approved boundary map ready with{" "}
          {approvedContext.boundaryItemCount} evidence-linked items. Every job
          is pinned to this map and its SOW version.
        </div>
      ) : (
        <div
          role="alert"
          className="
            rounded-md border border-audit-amber/30 bg-audit-amber/5 p-5
            text-audit-amber
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
    </>
  );
}
