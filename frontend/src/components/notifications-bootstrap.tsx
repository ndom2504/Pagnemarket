import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/src/auth";
import { useNotificationSummary } from "@/src/hooks/use-notification-summary";
import {
  addNotificationResponseListener,
  ensureAndroidChannel,
  maybePromptNotificationPermission,
  nativeNotificationsAvailable,
} from "@/src/notifications";

function routeForNotificationData(data: Record<string, unknown>, roles: string[] = []) {
  const href = typeof data?.href === "string" ? data.href : null;
  if (href) return href;
  const convId = data?.conversationId;
  if (typeof convId === "string" && convId) return `/conversation/${convId}`;
  const kind = data?.kind;
  if (kind === "order") {
    if (roles.includes("supplier") || roles.includes("admin")) return "/supplier";
    return "/orders";
  }
  if (kind === "sewing_order") {
    if (roles.includes("tailor") || roles.includes("admin")) return "/tailor/orders";
    return "/orders";
  }
  if (kind === "message") {
    if (roles.includes("supplier")) return "/supplier/messages";
    if (roles.includes("tailor")) return "/tailor/messages";
    return "/(tabs)/messages";
  }
  return "/notifications";
}

/** Sets up channels, asks permission once after login, handles notification taps.
 *  Also keeps the summary poll alive app-wide for order ringtones.
 */
export function NotificationsBootstrap() {
  const { user } = useAuth();
  const router = useRouter();
  useNotificationSummary();

  useEffect(() => {
    if (!user) return;
    let sub: { remove: () => void } | null = null;
    (async () => {
      if (nativeNotificationsAvailable) {
        await ensureAndroidChannel();
        await maybePromptNotificationPermission();
      }
      sub = addNotificationResponseListener((data) => {
        const path = routeForNotificationData(data, user.roles || []);
        router.push(path as any);
      });
    })().catch(() => {});
    return () => {
      sub?.remove();
    };
  }, [user?.id, router]);

  return null;
}
