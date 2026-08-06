"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Calculator,
  ClipboardList,
  FileText,
  Import,
  Plug,
  ListChecks,
  Receipt,
  ShieldCheck,
  Settings,
  UserRound,
  LockKeyhole,
  Bell,
  Workflow,
} from "lucide-react";
import { hasPermission } from "@/lib/auth/authorization";
import type { AuthContext, OrganizationRole, Permission } from "@/lib/auth/types";

const internalNav: Array<{
  href: string;
  label: string;
  icon: typeof Activity;
  permission?: Permission;
}> = [
  { href: "/request-audit", label: "Request Audit", icon: ClipboardList },
  { href: "/calculator", label: "Calculator", icon: Calculator },
  { href: "/app", label: "Audit Console", icon: BarChart3, permission: "projects:read" },
  { href: "/app/findings", label: "Findings", icon: ListChecks, permission: "findings:read" },
  { href: "/app/notifications", label: "Review Inbox", icon: Bell, permission: "findings:review" },
  { href: "/app/import", label: "Import", icon: Import, permission: "communications:write" },
  { href: "/app/integrations", label: "Integrations", icon: Plug, permission: "integrations:read" },
  { href: "/app/billing", label: "Billing", icon: Receipt, permission: "billing:read" },
  { href: "/admin", label: "Admin", icon: ShieldCheck, permission: "leads:read" },
  { href: "/sales-assets", label: "Sales Assets", icon: FileText, permission: "reports:read" },
  { href: "/account", label: "Account", icon: UserRound },
  { href: "/app/settings/ai", label: "AI Status", icon: Activity, permission: "settings:read" },
  { href: "/app/settings/system", label: "System", icon: Settings, permission: "settings:read" },
];

export function internalNavigationFor(role: OrganizationRole | null) {
  return internalNav.filter(
    (item) =>
      !item.permission || Boolean(role && hasPermission(role, item.permission)),
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
  const internal = ["/app", "/admin", "/sales-assets", "/account"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  const publicNav = [
    { href: "/#workflow", label: "Workflow", icon: Workflow },
    { href: "/#connections", label: "Connections", icon: Plug },
    { href: "/#pricing", label: "Pricing", icon: Receipt },
    { href: "/#security", label: "Security", icon: ShieldCheck },
    { href: "/request-audit", label: "Request Audit", icon: ClipboardList },
    { href: "/login", label: "Professional Sign In", icon: LockKeyhole },
  ];
  const navItems = internal
    ? internalNavigationFor(auth?.role || null)
    : publicNav;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-audit-border bg-white">
        <div className="
          mx-auto flex max-w-7xl flex-col gap-4 p-4
          sm:px-6
          lg:flex-row lg:items-center lg:justify-between lg:px-8
        ">
          <Link href="/" className="min-w-0">
            <div className="
              text-sm font-semibold tracking-[0.16em] text-audit-muted uppercase
            ">
              ScopeLedger
            </div>
            <div className="
              text-lg font-semibold text-ink
              sm:text-xl
            ">
              {internal ? "Revenue Recovery Workspace" : "Private Beta Revenue Control"}
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="
                    inline-flex h-10 items-center gap-2 rounded-md border
                    border-audit-border px-3 text-sm font-medium
                    hover:bg-audit-soft
                  "
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                  {item.href === "/app/notifications" && unreadNotifications > 0 ? (
                    <span className="
                      rounded-sm bg-ink px-1.5 py-0.5 text-xs text-white
                    ">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="
        mx-auto max-w-7xl px-4 py-8
        sm:px-6
        lg:px-8
      ">
        {children}
      </main>
    </div>
  );
}
