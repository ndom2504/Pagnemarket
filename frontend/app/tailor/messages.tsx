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

export default function TailorMessages() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const convs = useQuery({ queryKey: ["conversations"], queryFn: () => api("/conversations") });
  const data = (convs.data as any[]) || [];

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F7" }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Messages</Text>
        <NotificationBell />
      </View>
      {convs.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : data.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="message-circle" size={40} color={colors.muted} />
          <Text style={styles.emptyTxt}>Les demandes de couture apparaîtront ici.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => {
            const other =
              (item.participants as any[])?.find((p: any) => p.id !== user?.id) || item.participants?.[0];
            const unread = Number(item.unreadCount || 0);
            return (
              <Pressable
                style={[styles.row, unread > 0 && styles.rowUnread]}
                onPress={() => router.push(`/conversation/${item.id}` as any)}
              >
                <View style={styles.avatar}>
                  {other?.avatar ? (
                    <Image source={{ uri: mediaUrl(other.avatar) }} style={styles.avatarImg} contentFit="cover" />
                  ) : (
                    <Text style={{ color: "#FFF", fontWeight: "600" }}>{(other?.name || "?").charAt(0)}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, unread > 0 && { fontWeight: "700" }]}>{other?.name || "Client"}</Text>
                  <Text numberOfLines={1} style={styles.last}>
                    {item.lastMessage}
                  </Text>
                </View>
                {unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeTxt}>{unread}</Text>
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
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: { fontSize: 22, fontWeight: "600", color: colors.onSurface },
  empty: { alignItems: "center", marginTop: 56, gap: 10, paddingHorizontal: 32 },
  emptyTxt: { color: colors.muted, textAlign: "center", fontSize: 13 },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowUnread: { borderColor: colors.brandSecondary, backgroundColor: "#FFF9F6" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.surfaceInverse,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 48, height: 48 },
  name: { fontSize: 14, fontWeight: "500", color: colors.onSurface },
  last: { fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeTxt: { color: "#FFF", fontSize: 11, fontWeight: "700" },
});
