import { cache } from "react";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/authorization";
import { authContextForSession } from "@/lib/auth/clerkProvisioning";
import { cookieSession } from "@/lib/auth/clerkSession";
import type { AuthContext, Permission } from "@/lib/auth/types";

/**
 * Cached for the life of one request because a page renders many components
 * that each ask who is signed in, and every ask would otherwise verify the
 * token and touch the database again.
 */
const requestSession = cache(() => cookieSession());

export const currentAuthContext = cache(async (): Promise<AuthContext | null> => {
  const session = await requestSession();

  return session ? authContextForSession(session) : null;
});

/**
 * Signed in with no firm selected is a different situation from not being
 * signed in: sending those people to sign-in would bounce them straight back,
 * so they go to the organization picker instead.
 */
export async function requirePagePermission(permission: Permission) {
  const session = await requestSession();

  if (!session) redirect("/sign-in");

  const context = await currentAuthContext();

  if (!context) redirect("/choose-organization");

  if (!hasPermission(context.role, permission)) redirect("/app?notice=permission-denied");

  return context;
}
