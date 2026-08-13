import Link from "next/link";

type PageNavigationProps = {
  basePath: string;
  filters: Record<string, string | undefined>;
  cursor?: string;
  nextCursor: string | null;
};

function href(basePath: string, filters: Record<string, string | undefined>, cursor?: string) {
  const query = new URLSearchParams();

  for (const [name, value] of Object.entries(filters)) {
    if (value) query.set(name, value);
  }

  if (cursor) query.set("cursor", cursor);

  const search = query.toString();

  return search ? `${basePath}?${search}` : basePath;
}

const LINK_CLASS = `
  inline-flex h-11 items-center rounded-md border border-audit-border
  bg-white px-4 text-sm font-semibold
  hover:bg-audit-soft
`;

export function PageNavigation({ basePath, filters, cursor, nextCursor }: PageNavigationProps) {
  if (!cursor && !nextCursor) return null;

  return (
    <nav
      aria-label="Pagination"
      className="
        flex items-center justify-between gap-3 border-t border-audit-border
        px-5 py-4
      "
    >
      {cursor ? (
        <Link href={href(basePath, filters)} className={LINK_CLASS}>
          First page
        </Link>
      ) : (
        <span />
      )}
      {nextCursor ? (
        <Link href={href(basePath, filters, nextCursor)} className={LINK_CLASS}>
          Next page
        </Link>
      ) : (
        <span className="text-sm text-audit-muted">End of results</span>
      )}
    </nav>
  );
}
