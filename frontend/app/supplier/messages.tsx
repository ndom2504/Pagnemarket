import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { NotificationBell } from "@/src/components/notification-bell";
import { Icon } from "@/src/icon";
import { mediaUrl } from "@/src/media";
import { colors } from "@/src/theme";

/** Messages for supplier space — no client tab bar. */
export default function SupplierMessages() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const convs = useQuery({ queryKey: ["conversations"], queryFn: () => api("/conversations") });
  const data = (convs.data as any[]) || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Messages</Text>
        <NotificationBell testID="supplier-messages-bell" />
      </View>

      {convs.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : data.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="message-circle" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>Aucune conversation</Text>
          <Text style={styles.emptySub}>
            Les messages des clients à propos de vos tissus apparaîtront ici.
          </Text>
          <Text style={styles.shopHint}>{user?.shopName || "Votre boutique"}</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => {
            const other =
              (item.participants as any[])?.find((p: any) => p.id !== user?.id) ||
              item.participants?.[0];
            const unread = Number(item.unreadCount || 0);
            return (
              <Pressable
                style={[styles.convRow, unread > 0 && styles.convRowUnread]}
                testID={`conv-${item.id}`}
                onPress={() => router.push(`/conversation/${item.id}`)}
              >
                <View style={styles.convAvatar}>
                  {other?.avatar ? (
                    <Image source={{ uri: mediaUrl(other.avatar) }} style={styles.avatarImg} contentFit="cover" />
                  ) : (
                    <Text style={{ color: colors.onSurfaceInverse, fontWeight: "500" }}>
                      {(other?.name || "?").charAt(0)}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.convName, unread > 0 && styles.convNameUnread]}>
                    {other?.name || "Client"}
                  </Text>
                  <Text numberOfLines={1} style={[styles.convLast, unread > 0 && styles.convLastUnread]}>
                    {item.lastMessage}
                  </Text>
                </View>
                {unread > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{unread > 99 ? "99+" : unread}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: { fontSize: 28, fontWeight: "500", color: colors.onSurface, letterSpacing: -0.5 },
  empty: { padding: 32, alignItems: "center", gap: 8, marginTop: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "500", color: colors.onSurface, marginTop: 8 },
  emptySub: { color: colors.muted, textAlign: "center", fontSize: 13, lineHeight: 20 },
  shopHint: { marginTop: 12, color: colors.brandSecondary, fontSize: 13, fontWeight: "500" },
  convRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  convRowUnread: { borderColor: colors.brandSecondary, backgroundColor: "#FFF9F6" },
  convAvatar: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.surfaceInverse,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 48, height: 48 },
  convName: { fontWeight: "500", color: colors.onSurface, fontSize: 14 },
  convNameUnread: { fontWeight: "700" },
  convLast: { color: colors.muted, fontSize: 12, marginTop: 2 },
  convLastUnread: { color: colors.onSurface, fontWeight: "500" },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { color: colors.onBrandSecondary, fontSize: 11, fontWeight: "700" },
});
