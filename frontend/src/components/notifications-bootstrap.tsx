import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/src/auth";
import {
  addNotificationResponseListener,
  ensureAndroidChannel,
  maybePromptNotificationPermission,
  nativeNotificationsAvailable,
} from "@/src/notifications";

/** Sets up channels, asks permission once after login, handles notification taps. */
export function NotificationsBootstrap() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user || !nativeNotificationsAvailable) return;
    let sub: { remove: () => void } | null = null;
    (async () => {
      await ensureAndroidChannel();
      await maybePromptNotificationPermission();
      sub = addNotificationResponseListener((data) => {
        const convId = data?.conversationId;
        if (typeof convId === "string" && convId) {
          router.push(`/conversation/${convId}` as any);
          return;
        }
        if (data?.kind === "message") {
          router.push("/(tabs)/messages" as any);
          return;
        }
        router.push("/notifications" as any);
      });
    })().catch(() => {});
    return () => {
      sub?.remove();
    };
  }, [user?.id, router]);

  return null;
}
