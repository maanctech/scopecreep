export default function WorkspaceLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading workspace" className="
      sl-page animate-pulse
    ">
      <div className="border-b border-audit-border pb-6">
        <div className="h-3 w-28 rounded-sm bg-audit-border" />
        <div className="mt-4 h-8 w-72 max-w-full rounded-sm bg-audit-border" />
        <div className="
          mt-4 h-4 w-[560px] max-w-full rounded-sm bg-audit-border
        " />
      </div>
      <div className="border-y border-ink bg-bright-paper">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="
            grid min-h-20 gap-3 border-b border-audit-border p-4
            last:border-0
            sm:grid-cols-[5rem_minmax(0,1fr)_8rem] sm:items-center
          ">
            <div className="h-3 w-12 rounded-sm bg-audit-border" />
            <div className="h-4 w-48 max-w-full rounded-sm bg-audit-border" />
            <div className="
              h-6 w-24 max-w-full rounded-sm bg-audit-border
              sm:justify-self-end
            " />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading workspace</span>
    </div>
  );
}
