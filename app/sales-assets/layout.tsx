import { requirePagePermission } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

export default async function SalesAssetsLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission("reports:read");

  return children;
}
