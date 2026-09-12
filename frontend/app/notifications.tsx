import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Icon } from "@/src/icon";
import {
  getNotificationPermissionStatus,
  isExpoGo,
  nativeNotificationsAvailable,
  requestNotificationPermission,
} from "@/src/notifications";
import { colors } from "@/src/theme";

type InboxItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  conversationId?: string;
  createdAt: string;
  data?: { conversationId?: string };
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [perm, setPerm] = useState<string | null>(null);

  const refreshPerm = useCallback(async () => {
    if (!nativeNotificationsAvailable) {
      setPerm("unavailable");
      return;
    }
    setPerm(await getNotificationPermissionStatus());
  }, []);

  useQuery({
    queryKey: ["notif-perm"],
    queryFn: async () => {
      await refreshPerm();
      return true;
    },
  });

  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<InboxItem[]>("/notifications"),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const readAll = useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-summary"] });
    },
  });

  const markOne = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-summary"] });
    },
  });

  const enablePerms = async () => {
    await requestNotificationPermission();
    await refreshPerm();
  };

  const data = list.data || [];
  const permGranted = perm === "granted";

  const openItem = async (item: InboxItem) => {
    if (!item.read) markOne.mutate(item.id);
    const convId = item.conversationId || item.data?.conversationId;
    if (convId) {
      router.push(`/conversation/${convId}` as any);
      return;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="notif-back" style={styles.iconBtn} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        {data.some((n) => !n.read) ? (
          <Pressable
            testID="notif-read-all"
            onPress={() => readAll.mutate()}
            disabled={readAll.isPending}
          >
            <Text style={styles.readAll}>Tout lu</Text>
          </Pressable>
        ) : (
          <View style={{ width: 56 }} />
        )}
      </View>

      {isExpoGo ? (
        <View style={styles.permCard}>
          <View style={styles.permIcon}>
            <Icon name="bell" size={22} color={colors.brandSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.permTitle}>Alertes système limitées</Text>
            <Text style={styles.permSub}>
              Sous Expo Go, la sonnerie système n’est pas disponible. La cloche et les badges messages fonctionnent ; pour le son OS, utilisez un development build.
            </Text>
          </View>
        </View>
      ) : Platform.OS !== "web" && !permGranted ? (
        <View style={styles.permCard}>
          <View style={styles.permIcon}>
            <Icon name="bell" size={22} color={colors.brandSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.permTitle}>Activer les alertes</Text>
            <Text style={styles.permSub}>
              Sonnerie et icône de notification pour les messages et mises à jour.
            </Text>
          </View>
          <Pressable testID="notif-enable" style={styles.permBtn} onPress={enablePerms}>
            <Text style={styles.permBtnText}>Activer</Text>
          </Pressable>
        </View>
      ) : null}

      {list.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : data.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="bell" size={44} color={colors.muted} />
          <Text style={styles.emptyTitle}>Aucune notification</Text>
          <Text style={styles.emptySub}>Les nouveaux messages apparaîtront ici.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable
              testID={`notif-${item.id}`}
              style={[styles.row, !item.read && styles.rowUnread]}
              onPress={() => openItem(item)}
            >
              <View style={[styles.dot, item.read && { opacity: 0 }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text numberOfLines={2} style={styles.rowBody}>
                  {item.body}
                </Text>
                <Text style={styles.rowTime}>
                  {new Date(item.createdAt).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              {item.kind === "message" ? (
                <Icon name="message-circle" size={16} color={colors.muted} />
              ) : (
                <Icon name="bell" size={16} color={colors.muted} />
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
  },
  title: { flex: 1, fontSize: 20, fontWeight: "600", color: colors.onSurface },
  readAll: { color: colors.brandSecondary, fontWeight: "600", fontSize: 13, width: 56, textAlign: "right" },
  permCard: {
    margin: 16,
    marginBottom: 0,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceSecondary,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  permIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  permTitle: { fontWeight: "600", color: colors.onSurface, fontSize: 14 },
  permSub: { color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  permBtn: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  permBtnText: { color: colors.onBrandPrimary, fontWeight: "600", fontSize: 12 },
  empty: { alignItems: "center", marginTop: 56, paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: colors.onSurface, marginTop: 8 },
  emptySub: { color: colors.muted, textAlign: "center", fontSize: 13 },
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowUnread: { borderColor: colors.brandSecondary, backgroundColor: "#FFF9F6" },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.brandSecondary,
    marginTop: 6,
  },
  rowTitle: { fontWeight: "600", color: colors.onSurface, fontSize: 14 },
  rowBody: { color: colors.muted, fontSize: 13, marginTop: 3, lineHeight: 18 },
  rowTime: { color: colors.muted, fontSize: 11, marginTop: 6 },
});
