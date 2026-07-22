import { requirePagePermission } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

export default async function NewProjectLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission("projects:write");
  return children;
}
