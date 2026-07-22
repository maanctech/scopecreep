import { requirePagePermission } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission("leads:read");
  return children;
}
