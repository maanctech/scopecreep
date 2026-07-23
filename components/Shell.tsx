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
  Workflow,
} from "lucide-react";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const internal = ["/app", "/admin", "/sales-assets", "/account"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  const internalNav = [
    { href: "/request-audit", label: "Request Audit", icon: ClipboardList },
    { href: "/calculator", label: "Calculator", icon: Calculator },
    { href: "/app", label: "Audit Console", icon: BarChart3 },
    { href: "/app/findings", label: "Findings", icon: ListChecks },
    { href: "/app/import", label: "Import", icon: Import },
    { href: "/app/integrations", label: "Integrations", icon: Plug },
    { href: "/app/billing", label: "Billing", icon: Receipt },
    { href: "/admin", label: "Admin", icon: ShieldCheck },
    { href: "/sales-assets", label: "Sales Assets", icon: FileText },
    { href: "/account", label: "Account", icon: UserRound },
    { href: "/app/settings/ai", label: "AI Status", icon: Activity },
    { href: "/app/settings/system", label: "System", icon: Settings },
  ];
  const publicNav = [
    { href: "/#workflow", label: "Workflow", icon: Workflow },
    { href: "/#connections", label: "Connections", icon: Plug },
    { href: "/#pricing", label: "Pricing", icon: Receipt },
    { href: "/#security", label: "Security", icon: ShieldCheck },
    { href: "/request-audit", label: "Request Audit", icon: ClipboardList },
    { href: "/login", label: "Professional Sign In", icon: LockKeyhole },
  ];
  const navItems = internal ? internalNav : publicNav;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-audit-border bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link href="/" className="min-w-0">
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-audit-muted">
              ScopeLedger
            </div>
            <div className="text-lg font-semibold text-ink sm:text-xl">
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
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-audit-border px-3 text-sm font-medium hover:bg-audit-soft"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
