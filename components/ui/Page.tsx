import type { ReactNode } from "react";

export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`
    sl-page
    ${className}
  `}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  reference = "CASE FILE / ACTIVE",
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  reference?: string;
}) {
  return (
    <header className="sl-page-header">
      <div className="min-w-0">
        <p className="sl-coordinate">{reference}</p>
        {eyebrow ? <p className="sl-eyebrow mt-4">{eyebrow}</p> : null}
        <h1 className={`
          sl-title
          ${eyebrow ? "mt-2" : ""}
        `}>{title}</h1>
        {description ? <div className="sl-description mt-3">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="
      flex flex-col gap-3
      sm:flex-row sm:items-end sm:justify-between
    ">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
        {description ? <div className="
          mt-1 max-w-3xl text-sm/6 text-audit-muted
        ">{description}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="
      relative border-y border-dashed border-audit-border bg-bright-paper px-6
      py-10
    ">
      <p className="sl-coordinate">No ledger entries</p>
      <h3 className="mt-4 font-semibold text-ink">{title}</h3>
      <div className="mt-2 max-w-xl text-sm/6 text-audit-muted">{description}</div>
      {action ? <div className="mt-5 flex">{action}</div> : null}
    </div>
  );
}
