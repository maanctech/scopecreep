import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/service";
import type { AuthContext, Permission } from "@/lib/auth/types";

export { SESSION_COOKIE_NAME } from "@/lib/auth/sessionConfig";
import { SESSION_COOKIE_NAME } from "@/lib/auth/sessionConfig";

export async function currentAuthContext(): Promise<AuthContext | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  return token ? getAuthContext(token) : null;
}

export async function requirePagePermission(permission: Permission) {
  const context = await currentAuthContext();

  if (!context) redirect("/login");

  if (!hasPermission(context.role, permission)) redirect("/app?notice=permission-denied");

  return context;
}
