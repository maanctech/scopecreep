import { requirePagePermission } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

export default async function AuditConsoleLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission("projects:read");

  return children;
}
