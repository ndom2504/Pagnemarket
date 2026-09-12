import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { notifyIfOrdersIncreased, notifyIfUnreadIncreased } from "@/src/notifications";

export type NotificationSummary = {
  unreadMessages: number;
  unreadNotifications: number;
  unreadOrders: number;
  latestOrder?: {
    id?: string;
    kind?: string;
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
  } | null;
  total: number;
};

export function useNotificationSummary() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["notifications-summary"],
    queryFn: () => api<NotificationSummary>("/notifications/summary"),
    enabled: !!user,
    refetchInterval: 10000,
  });

  useEffect(() => {
    const n = q.data?.unreadMessages;
    if (typeof n === "number") {
      notifyIfUnreadIncreased(n).catch(() => {});
    }
  }, [q.data?.unreadMessages]);

  useEffect(() => {
    const n = q.data?.unreadOrders;
    if (typeof n === "number") {
      notifyIfOrdersIncreased(n, q.data?.latestOrder).catch(() => {});
    }
  }, [q.data?.unreadOrders, q.data?.latestOrder]);

  return {
    unreadMessages: q.data?.unreadMessages ?? 0,
    unreadNotifications: q.data?.unreadNotifications ?? 0,
    unreadOrders: q.data?.unreadOrders ?? 0,
    total: q.data?.total ?? 0,
    ...q,
  };
}
