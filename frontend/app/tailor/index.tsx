import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
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

/** Tailor atelier — messages from clients who want a fabric sewn. */
export default function TailorHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const convs = useQuery({ queryKey: ["conversations"], queryFn: () => api("/conversations") });
  const data = (convs.data as any[]) || [];

  const handleSignOut = async () => {
    await signOut();
    router.replace("/auth");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Atelier tailleur</Text>
          <Text style={styles.subtitle}>
            {user?.firstName} {user?.lastName}
            {user?.specialty ? ` · ${user.specialty}` : ""}
            {user?.city || user?.country
              ? ` · ${[user?.city, user?.country].filter(Boolean).join(", ")}`
              : ""}
          </Text>
        </View>
        <NotificationBell testID="tailor-notif-bell" />
        <Pressable testID="tailor-settings" style={styles.iconBtn} onPress={() => router.push("/settings")}>
          <Icon name="settings" size={18} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
        <View style={styles.hero}>
          <Icon name="scissors" size={22} color={colors.brandTertiary} />
          <Text style={styles.heroTitle}>Demandes de couture</Text>
          <Text style={styles.heroSub}>
            Les clients vous contactent depuis un tissu. Répondez ici pour convenir de la coupe.
          </Text>
        </View>

        <View style={styles.navRow}>
          <Pressable testID="tailor-profile" style={styles.navBtn} onPress={() => router.push("/settings")}>
            <Icon name="user" size={16} color={colors.onSurface} />
            <Text style={styles.navLbl}>Profil</Text>
          </Pressable>
          <Pressable testID="tailor-signout" style={styles.navBtn} onPress={handleSignOut}>
            <Icon name="log-out" size={16} color={colors.error} />
            <Text style={[styles.navLbl, { color: colors.error }]}>Déconnexion</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Messages</Text>
        {convs.isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} />
        ) : data.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="message-circle" size={36} color={colors.muted} />
            <Text style={styles.emptyTxt}>Pas encore de demande. Votre atelier est prêt.</Text>
          </View>
        ) : (
          <FlatList
            data={data}
            scrollEnabled={false}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => {
              const other =
                (item.participants as any[])?.find((p: any) => p.id !== user?.id) ||
                item.participants?.[0];
              const unread = Number(item.unreadCount || 0);
              return (
                <Pressable
                  style={[styles.convRow, unread > 0 && styles.convRowUnread]}
                  testID={`tailor-conv-${item.id}`}
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
                    <Text style={[styles.convName, unread > 0 && { fontWeight: "700" }]}>
                      {other?.name || "Client"}
                    </Text>
                    <Text numberOfLines={1} style={[styles.convLast, unread > 0 && { color: colors.onSurface, fontWeight: "500" }]}>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 8,
  },
  title: { fontSize: 22, fontWeight: "500", color: colors.onSurface, letterSpacing: -0.4 },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    backgroundColor: colors.surfaceInverse,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  heroTitle: { color: colors.onSurfaceInverse, fontSize: 18, fontWeight: "500" },
  heroSub: { color: colors.onSurfaceInverse, opacity: 0.75, fontSize: 13, lineHeight: 19 },
  navRow: { flexDirection: "row", gap: 8 },
  navBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navLbl: { fontSize: 13, fontWeight: "500", color: colors.onSurface },
  section: { fontSize: 15, fontWeight: "500", color: colors.onSurface },
  empty: { alignItems: "center", gap: 10, paddingVertical: 28 },
  emptyTxt: { color: colors.muted, textAlign: "center", fontSize: 13, lineHeight: 19 },
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
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.surfaceInverse,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 44, height: 44 },
  convName: { fontWeight: "500", color: colors.onSurface, fontSize: 14 },
  convLast: { color: colors.muted, fontSize: 12, marginTop: 2 },
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
