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
import { Icon } from "@/src/icon";
import { mediaUrl } from "@/src/media";
import { colors } from "@/src/theme";

export type ConversationRow = {
  id: string;
  lastMessage?: string;
  updatedAt?: string;
  unreadCount?: number;
  participants?: {
    id: string;
    name?: string;
    avatar?: string | null;
    roles?: string[];
  }[];
};

function formatConvTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday.getTime() - startMsg.getTime()) / 86400000);
  if (diffDays === 0) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) {
    return d.toLocaleDateString("fr-FR", { weekday: "short" });
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function roleLabel(roles?: string[]) {
  const r = roles || [];
  if (r.includes("supplier")) return "Fournisseur";
  if (r.includes("tailor")) return "Tailleur";
  if (r.includes("admin")) return "Support";
  return "Client";
}

export function peerFromConversation(item: ConversationRow, myId?: string) {
  const parts = item.participants || [];
  return parts.find((p) => p.id && p.id !== myId) || parts[0];
}

type Props = {
  data: ConversationRow[];
  loading?: boolean;
  myUserId?: string;
  emptyTitle?: string;
  emptySub?: string;
  testIDPrefix?: string;
};

/** Inbox list shared by buyer / supplier / tailor spaces. */
export function ConversationInbox({
  data,
  loading,
  myUserId,
  emptyTitle = "Aucune conversation",
  emptySub = "Vos échanges apparaîtront ici.",
  testIDPrefix = "conv",
}: Props) {
  const router = useRouter();

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />;
  }

  if (!data.length) {
    return (
      <View style={styles.empty}>
        <Icon name="message-circle" size={44} color={colors.muted} />
        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        <Text style={styles.emptySub}>{emptySub}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(i) => i.id}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 24 }}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      renderItem={({ item }) => {
        const other = peerFromConversation(item, myUserId);
        const unread = Number(item.unreadCount || 0);
        const name = other?.name?.trim() || "Conversation";
        return (
          <Pressable
            style={[styles.row, unread > 0 && styles.rowUnread]}
            testID={`${testIDPrefix}-${item.id}`}
            onPress={() => router.push(`/conversation/${item.id}` as any)}
          >
            <View style={styles.avatar}>
              {other?.avatar ? (
                <Image source={{ uri: mediaUrl(other.avatar) }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.body}>
              <View style={styles.topLine}>
                <Text style={[styles.name, unread > 0 && styles.nameUnread]} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={[styles.time, unread > 0 && styles.timeUnread]}>
                  {formatConvTime(item.updatedAt)}
                </Text>
              </View>
              <View style={styles.bottomLine}>
                <Text style={styles.role} numberOfLines={1}>
                  {roleLabel(other?.roles)}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.preview, unread > 0 && styles.previewUnread]}
                >
                  {item.lastMessage || "—"}
                </Text>
                {unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeTxt}>{unread > 99 ? "99+" : unread}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingHorizontal: 32,
    paddingTop: 56,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: colors.onSurface, marginTop: 6 },
  emptySub: { color: colors.muted, textAlign: "center", fontSize: 13, lineHeight: 19 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 76 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  rowUnread: { backgroundColor: "#FFF9F6" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: colors.surfaceInverse,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 52, height: 52 },
  avatarLetter: { color: colors.onSurfaceInverse, fontWeight: "600", fontSize: 18 },
  body: { flex: 1, minWidth: 0, gap: 4 },
  topLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.onSurface },
  nameUnread: { fontWeight: "700" },
  time: { fontSize: 11, color: colors.muted },
  timeUnread: { color: colors.brandSecondary, fontWeight: "600" },
  bottomLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  role: {
    fontSize: 11,
    color: colors.muted,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
    maxWidth: 96,
  },
  preview: { flex: 1, fontSize: 13, color: colors.muted },
  previewUnread: { color: colors.onSurface, fontWeight: "500" },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: { color: colors.onBrandSecondary, fontSize: 11, fontWeight: "700" },
});
