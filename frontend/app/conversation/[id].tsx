import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { Icon } from "@/src/icon";
import { mediaUrl } from "@/src/media";
import { colors } from "@/src/theme";

export default function ConversationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);

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

  const other =
    ((conv.data as any)?.participants as any[])?.find((p: any) => p.id !== user?.id) ||
    (conv.data as any)?.participants?.[0];
  const isParticipant = ((conv.data as any)?.participantIds || []).includes(user?.id);
  const isAdminViewer = (user?.roles || []).includes("admin") && !isParticipant;

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
    },
  });

  const data = (messages.data as any[]) || [];

  useEffect(() => {
    if (data.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [data.length]);

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
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {other?.name || "Conversation"}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {(other?.roles || []).includes("supplier")
              ? "Fournisseur"
              : (other?.roles || []).includes("tailor")
                ? "Tailleur"
                : "Client"}
          </Text>
        </View>
      </View>

      {messages.isLoading || conv.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : (
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 12 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Text style={styles.empty}>Commencez la conversation.</Text>
          }
          renderItem={({ item }) => {
            const mine = item.fromUserId === user?.id;
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, mine && { color: colors.onSurfaceInverse }]}>
                  {item.text}
                </Text>
                <Text style={[styles.time, mine && { color: "rgba(250,248,243,0.65)" }]}>
                  {new Date(item.createdAt).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            );
          }}
        />
      )}

      {!isAdminViewer && (
        <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
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
      )}
      {isAdminViewer && (
        <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
          <Text style={{ color: colors.muted, fontSize: 13, flex: 1, textAlign: "center" }}>
            Lecture seule (admin)
          </Text>
        </View>
      )}
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
  empty: { textAlign: "center", color: colors.muted, marginTop: 40 },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 4,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.surfaceInverse,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
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
    borderTopWidth: 1,
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
    borderWidth: 1,
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
