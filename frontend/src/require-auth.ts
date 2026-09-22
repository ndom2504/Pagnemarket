import type { Router } from "expo-router";

/** Redirect guests to login for account-based actions (cart, messages, checkout). */
export function requireAuth(
  user: { id?: string } | null | undefined,
  router: Pick<Router, "push">,
  returnTo?: string,
): boolean {
  if (user?.id) return true;
  router.push({
    pathname: "/auth",
    params: returnTo ? { returnTo } : undefined,
  } as any);
  return false;
}
