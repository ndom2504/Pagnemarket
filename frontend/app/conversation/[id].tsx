import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { peerFromConversation } from "@/src/components/conversation-inbox";
import { SafetyActionsModal } from "@/src/components/safety-actions-modal";
import { Icon } from "@/src/icon";
import { mediaUrl } from "@/src/media";
import { colors } from "@/src/theme";

type Msg = {
  id: string;
  fromUserId: string;
  text: string;
  createdAt: string;
};

type Row =
  | { type: "day"; id: string; label: string }
  | { type: "msg"; id: string; msg: Msg };

function dayKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((startToday.getTime() - startMsg.getTime()) / 86400000);
  if (diff === 0) return "Aujourd’hui";
  if (diff === 1) return "Hier";
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function roleLabel(roles?: string[]) {
  const r = roles || [];
  if (r.includes("supplier")) return "Fournisseur";
  if (r.includes("tailor")) return "Tailleur";
  if (r.includes("admin")) return "Support";
  return "Client";
}

export default function ConversationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [text, setText] = useState("");
  const [safetyOpen, setSafetyOpen] = useState(false);

  const conv = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => api(`/conversations/${id}`),
    enabled: !!id,
  });
  const messages = useQuery({
    queryKey: ["messages", id],
    queryFn: () => api(`/messages/${id}`),
    enabled: !!id,
    refetchInterval: 4000,
  });

  const other = peerFromConversation((conv.data as any) || {}, user?.id);
  const isParticipant = ((conv.data as any)?.participantIds || []).includes(user?.id);
  const isAdminViewer = (user?.roles || []).includes("admin") && !isParticipant;

  const chronological = ((messages.data as Msg[]) || []).slice().sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  /** Inverted FlatList: index 0 sits at the bottom → newest messages first. */
  const rows: Row[] = useMemo(() => {
    const newestFirst = chronological.slice().reverse();
    const out: Row[] = [];
    for (let i = 0; i < newestFirst.length; i++) {
      const msg = newestFirst[i];
      out.push({ type: "msg", id: msg.id, msg });
      const cur = dayKey(msg.createdAt);
      const older = newestFirst[i + 1];
      const olderDay = older ? dayKey(older.createdAt) : null;
      if (olderDay && olderDay !== cur) {
        out.push({ type: "day", id: `day-${cur}-${i}`, label: dayLabel(msg.createdAt) });
      }
    }
    if (newestFirst.length) {
      const oldest = newestFirst[newestFirst.length - 1];
      out.push({
        type: "day",
        id: `day-oldest-${dayKey(oldest.createdAt)}`,
        label: dayLabel(oldest.createdAt),
      });
    }
    return out;
  }, [chronological]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      if (!other?.id) throw new Error("Destinataire manquant");
      return api("/messages/send", {
        method: "POST",
        body: JSON.stringify({ toUserId: other.id, toName: other.name, text: body }),
      });
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation", id] });
      qc.invalidateQueries({ queryKey: ["notifications-summary"] });
    },
  });

  useEffect(() => {
    if (!id || !isParticipant) return;
    api(`/conversations/${id}/read`, { method: "POST" })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["conversations"] });
        qc.invalidateQueries({ queryKey: ["notifications-summary"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .catch(() => {});
  }, [id, isParticipant, chronological.length, qc]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="conv-back" style={styles.iconBtn} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <View style={styles.headerAvatar}>
          {other?.avatar ? (
            <Image source={{ uri: mediaUrl(other.avatar) }} style={styles.avatarImg} contentFit="cover" />
          ) : (
            <Text style={styles.avatarLetter}>{(other?.name || "?").charAt(0)}</Text>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>
            {other?.name || "Conversation"}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {roleLabel(other?.roles)}
          </Text>
        </View>
        {other?.id && !isAdminViewer ? (
          <Pressable testID="conv-safety" style={styles.iconBtn} onPress={() => setSafetyOpen(true)}>
            <Icon name="more-horizontal" size={20} color={colors.onSurface} />
          </Pressable>
        ) : null}
      </View>

      {messages.isLoading || conv.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : (
        <FlatList
          inverted
          data={rows}
          keyExtractor={(r) => r.id}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexGrow: 1,
            justifyContent: rows.length ? undefined : "center",
          }}
          ListEmptyComponent={<Text style={styles.empty}>Commencez la conversation.</Text>}
          renderItem={({ item }) => {
            if (item.type === "day") {
              return (
                <View style={styles.dayWrap}>
                  <Text style={styles.dayLabel}>{item.label}</Text>
                </View>
              );
            }
            const mine = item.msg.fromUserId === user?.id;
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, mine && { color: colors.onSurfaceInverse }]}>
                  {item.msg.text}
                </Text>
                <Text style={[styles.time, mine && { color: "rgba(250,248,243,0.65)" }]}>
                  {new Date(item.msg.createdAt).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            );
          }}
        />
      )}

      {!isAdminViewer ? (
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            testID="conv-input"
            style={styles.input}
            placeholder="Écrire un message…"
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            multiline
          />
          <Pressable
            testID="conv-send"
            style={[styles.sendBtn, (!text.trim() || send.isPending) && { opacity: 0.45 }]}
            disabled={!text.trim() || send.isPending}
            onPress={() => send.mutate(text.trim())}
          >
            {send.isPending ? (
              <ActivityIndicator color={colors.onSurfaceInverse} />
            ) : (
              <Icon name="send" size={18} color={colors.onSurfaceInverse} />
            )}
          </Pressable>
        </View>
      ) : (
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Text style={{ color: colors.muted, fontSize: 13, flex: 1, textAlign: "center" }}>
            Lecture seule (admin)
          </Text>
        </View>
      )}

      {other?.id ? (
        <SafetyActionsModal
          visible={safetyOpen}
          onClose={() => setSafetyOpen(false)}
          userId={other.id}
          targetType="user"
          targetId={other.id}
          targetLabel={other.name}
          onBlocked={() => {
            qc.invalidateQueries({ queryKey: ["conversations"] });
            router.back();
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.surfaceInverse,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 40, height: 40 },
  avatarLetter: { color: colors.onSurfaceInverse, fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "600", color: colors.onSurface },
  sub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  empty: { textAlign: "center", color: colors.muted },
  dayWrap: {
    alignItems: "center",
    marginVertical: 10,
  },
  dayLabel: {
    fontSize: 11,
    color: colors.muted,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    textTransform: "capitalize",
  },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    gap: 4,
    marginVertical: 3,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.surfaceInverse,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceTertiary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, color: colors.onSurface, lineHeight: 21 },
  time: { fontSize: 10, color: colors.muted, alignSelf: "flex-end" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.onSurface,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
});
