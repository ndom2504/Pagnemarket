import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { notifyIfUnreadIncreased } from "@/src/notifications";

export type NotificationSummary = {
  unreadMessages: number;
  unreadNotifications: number;
  total: number;
};

export function useNotificationSummary() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["notifications-summary"],
    queryFn: () => api<NotificationSummary>("/notifications/summary"),
    enabled: !!user,
    refetchInterval: 12000,
  });

  useEffect(() => {
    const n = q.data?.unreadMessages;
    if (typeof n === "number") {
      notifyIfUnreadIncreased(n).catch(() => {});
    }
  }, [q.data?.unreadMessages]);

  return {
    unreadMessages: q.data?.unreadMessages ?? 0,
    unreadNotifications: q.data?.unreadNotifications ?? 0,
    total: q.data?.total ?? 0,
    ...q,
  };
}
