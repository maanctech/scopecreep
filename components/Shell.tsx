"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Bell,
  Building2,
  ChevronRight,
  FileText,
  Import,
  ListChecks,
  Menu,
  Plug,
  Receipt,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { hasPermission } from "@/lib/auth/authorization";
import type { AuthContext, OrganizationRole, Permission } from "@/lib/auth/types";

type NavigationItem = {
  href: string;
  label: string;
  icon: typeof Activity;
  permission?: Permission;
  badge?: boolean;
};

const internalGroups: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: "Revenue",
    items: [
      { href: "/app/notifications", label: "Needs review", icon: Bell, permission: "findings:review", badge: true },
      { href: "/app", label: "Revenue overview", icon: BarChart3, permission: "projects:read" },
      { href: "/app/findings", label: "All findings", icon: ListChecks, permission: "findings:read" },
      { href: "/app/billing", label: "Billing record", icon: Receipt, permission: "billing:read" },
    ],
  },
  {
    label: "Projects",
    items: [
      { href: "/app/import", label: "Import requests", icon: Import, permission: "communications:write" },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { href: "/app/integrations", label: "Connections", icon: Plug, permission: "integrations:read" },
      { href: "/app/settings/ai", label: "AI provider", icon: Activity, permission: "settings:read" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin", label: "Leads and audits", icon: Building2, permission: "leads:read" },
      { href: "/sales-assets", label: "Sales assets", icon: FileText, permission: "reports:read" },
      { href: "/app/settings/system", label: "System operations", icon: Settings, permission: "settings:read" },
      { href: "/account", label: "Account", icon: UserRound },
    ],
  },
];

const publicLinks = [
  { href: "/#product", label: "Product" },
  { href: "/#workflow", label: "How it works" },
  { href: "/#security", label: "Security" },
  { href: "/#pilot", label: "Pilot" },
];

export function internalNavigationFor(role: OrganizationRole | null) {
  return internalGroups
    .flatMap((group) => group.items)
    .filter((item) => !item.permission || Boolean(role && hasPermission(role, item.permission)));
}

function activePath(pathname: string, href: string) {
  if (href === "/app") return pathname === href || pathname.startsWith("/app/projects");

  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3">
      <span className="
        relative flex size-8 shrink-0 items-center justify-center bg-ink
        text-white
        after:absolute after:right-0 after:bottom-0 after:h-0.5 after:w-3
        after:bg-signal
      ">
        <BadgeDollarSign className="size-4" aria-hidden="true" />
      </span>
      <span className={compact ? "font-semibold tracking-tight" : "min-w-0"}>
        <span className="block font-semibold tracking-tight text-ink">ScopeLedger</span>
        {!compact ? <span className="
          sl-metadata block text-[0.5625rem]/3 text-audit-muted
        ">FORENSIC REVENUE CONTROL</span> : null}
      </span>
    </Link>
  );
}

function InternalNavigation({
  pathname,
  role,
  unreadNotifications,
  onNavigate,
}: {
  pathname: string;
  role: OrganizationRole | null;
  unreadNotifications: number;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Workspace" className="space-y-6">
      {internalGroups.map((group) => {
        const items = group.items.filter(
          (item) => !item.permission || Boolean(role && hasPermission(role, item.permission)),
        );

        if (!items.length) return null;

        return (
          <div key={group.label}>
            <p className="sl-metadata px-3 text-[0.625rem] text-audit-muted">
              {String(internalGroups.indexOf(group) + 1).padStart(2, "0")} / {group.label.toUpperCase()}
            </p>
            <div className="mt-2 space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active = activePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`
                      group relative flex min-h-10 items-center gap-3 px-3
                      text-sm font-medium transition-all duration-150 ease-out
                      ${active ? `
                        bg-bright-paper text-ink shadow-audit
                        before:absolute before:inset-y-0 before:left-0
                        before:w-0.5 before:bg-signal
                      ` : `
                        text-audit-muted
                        hover:bg-white/70 hover:text-ink
                      `}
                    `}
                  >
                    <Icon className={`
                      size-4 shrink-0
                      ${active ? "text-signal" : `text-audit-muted`}
                    `} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge && unreadNotifications > 0 ? (
                      <span className="
                        bg-ink px-1.5 py-0.5 text-[0.6875rem] font-semibold
                        text-white
                      ">
                        {unreadNotifications > 99 ? "99+" : unreadNotifications}
                      </span>
                    ) : active ? (
                      <ChevronRight className="size-3.5 text-inverse-muted" aria-hidden="true" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function PublicHeader({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  return (
    <header className="sticky top-0 z-50 border-b border-audit-border bg-paper">
      <div className="
        mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-5
        sm:px-6
      ">
        <Brand compact />
        <nav aria-label="Primary" className="
          hidden items-center gap-1
          lg:flex
        ">
          {publicLinks.map((item) => (
            <Link key={item.href} href={item.href} className="
              sl-button-quiet min-h-9 px-3 font-mono text-xs
            ">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="
          hidden items-center gap-1
          sm:flex
        ">
          <Link href="/login" className="sl-button-quiet">Professional sign in</Link>
          <Link href="/request-audit" className="sl-button-primary min-h-9">Request audit</Link>
        </div>
        <button
          type="button"
          className="
            flex size-11 items-center justify-center border border-audit-border
            bg-white
            sm:hidden
          "
          aria-expanded={open}
          aria-controls="public-mobile-navigation"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="
            size-5
          " aria-hidden="true" />}
        </button>
      </div>
      {open ? (
        <nav id="public-mobile-navigation" aria-label="Mobile primary" className="
          border-t border-audit-border bg-white px-5 py-4
          sm:hidden
        ">
          <div className="grid gap-1">
            {publicLinks.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="
                sl-button-quiet justify-start px-2
              ">
                {item.label}
              </Link>
            ))}
            <Link href="/login" onClick={() => setOpen(false)} className="
              sl-button-secondary mt-2
            ">Professional sign in</Link>
            <Link href="/request-audit" onClick={() => setOpen(false)} className="
              sl-button-primary
            ">Request audit</Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}

export function Shell({
  children,
  auth,
  unreadNotifications = 0,
}: {
  children: React.ReactNode;
  auth: Pick<AuthContext, "role" | "isSystemAdmin"> | null;
  unreadNotifications?: number;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const internal = ["/app", "/admin", "/sales-assets", "/account"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!internal) {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <PublicHeader open={menuOpen} setOpen={setMenuOpen} />
        <main className={pathname === "/" ? "" : `
          px-5
          sm:px-6
        `}>{children}</main>
      </div>
    );
  }

  return (
    <div className="
      min-h-screen bg-paper text-ink
      lg:grid lg:grid-cols-[224px_minmax(0,1fr)]
    ">
      <aside className="
        fixed inset-y-0 left-0 z-40 hidden w-[224px] border-r
        border-audit-border bg-audit-soft
        lg:flex lg:flex-col
      ">
        <div className="border-b border-audit-border p-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <InternalNavigation pathname={pathname} role={auth?.role || null} unreadNotifications={unreadNotifications} />
        </div>
        <div className="border-t border-audit-border px-5 py-4">
          <div className="flex items-center gap-2 text-xs text-audit-muted">
            <ShieldCheck className="size-4" aria-hidden="true" />
            <span>{auth?.role || "Professional"} access</span>
          </div>
        </div>
      </aside>

      <div className="
        min-w-0
        lg:col-start-2
      ">
        <header className="
          sticky top-0 z-20 hidden h-12 items-center justify-between border-b
          border-audit-border bg-paper px-6
          lg:flex
        ">
          <p className="sl-coordinate">Command / professional workspace</p>
          <Link href="/app/notifications" className="
            inline-flex items-center gap-2 text-xs font-semibold
            hover:text-signal
          ">
            <Bell className="size-3.5" aria-hidden="true" />
            Review inbox
            {unreadNotifications > 0 ? <span className="sl-metadata text-signal">{unreadNotifications}</span> : null}
          </Link>
        </header>
        <header className="
          sticky top-0 z-30 flex h-16 items-center justify-between border-b
          border-audit-border bg-paper px-4
          lg:hidden
        ">
          <Brand compact />
          <button
            type="button"
            className="
              flex size-11 items-center justify-center border
              border-audit-border bg-white
            "
            aria-expanded={menuOpen}
            aria-controls="workspace-mobile-navigation"
            aria-label={menuOpen ? "Close workspace navigation" : "Open workspace navigation"}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="
              size-5
            " aria-hidden="true" />}
          </button>
        </header>
        {menuOpen ? (
          <div id="workspace-mobile-navigation" className="
            fixed inset-x-0 top-16 z-30 max-h-[calc(100vh-4rem)] overflow-y-auto
            border-b border-audit-border bg-audit-soft p-4
            lg:hidden
          ">
            <InternalNavigation
              pathname={pathname}
              role={auth?.role || null}
              unreadNotifications={unreadNotifications}
              onNavigate={() => setMenuOpen(false)}
            />
          </div>
        ) : null}
        <main className="
          mx-auto w-full max-w-[1480px] px-4 py-6
          sm:px-6 sm:py-8
          xl:p-10
        ">
          {children}
        </main>
      </div>
    </div>
  );
}
