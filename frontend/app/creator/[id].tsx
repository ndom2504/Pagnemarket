import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, formatXAF } from "@/src/api";
import { SafetyActionsModal } from "@/src/components/safety-actions-modal";
import { Icon } from "@/src/icon";
import { cardPreviewUrl, mediaUrl } from "@/src/media";
import { colors } from "@/src/theme";

export default function CreatorProfile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<"models" | "bio">("models");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);

  const q = useQuery({ queryKey: ["creator", id], queryFn: () => api(`/creators/${id}`) });
  const send = useMutation({
    mutationFn: (text: string) => {
      const toUserId = q.data?.creator?.userId || id;
      return api("/messages/send", {
        method: "POST",
        body: JSON.stringify({ toUserId, toName: q.data?.creator?.name, text }),
      });
    },
    onSuccess: (msg: any) => {
      setSent(true);
      setMsg("");
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (msg?.conversationId) {
        router.push(`/conversation/${msg.conversationId}`);
      }
      setTimeout(() => setSent(false), 3000);
    },
  });

  const requestSew = useMutation({
    mutationFn: (modelId?: string) =>
      api("/sewing-requests", {
        method: "POST",
        body: JSON.stringify({
          creatorId: id,
          tailorUserId: q.data?.creator?.userId || id,
          modelId: modelId || null,
          title: "Demande de confection",
          notes: msg.trim() || null,
        }),
      }),
    onSuccess: () => {
      setOrderSent(true);
      setMsg("");
      setTimeout(() => setOrderSent(false), 4000);
    },
  });

  if (q.isLoading || !q.data) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  const { creator, models } = q.data as any;
  const coverUri = cardPreviewUrl(
    creator.cardImage,
    creator.cover,
    creator.previewImage,
    models?.[0]?.image,
    creator.avatar,
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 240, backgroundColor: colors.surfaceInverse }}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : null}
          <LinearGradient
            colors={["rgba(17,17,17,0.4)", "rgba(17,17,17,0.85)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable testID="creator-back" style={styles.iconBtn} onPress={() => router.back()}>
              <Icon name="arrow-left" size={20} color={colors.onSurfaceInverse} />
            </Pressable>
            <Pressable testID="creator-safety" style={styles.iconBtn} onPress={() => setSafetyOpen(true)}>
              <Icon name="more-horizontal" size={20} color={colors.onSurfaceInverse} />
            </Pressable>
          </View>
        </View>

        <View style={styles.headerBlock}>
          {mediaUrl(creator.avatar) ? (
            <Image source={{ uri: mediaUrl(creator.avatar) }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, { alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary }]}>
              <Text style={{ color: "#FFF", fontSize: 36, fontWeight: "700" }}>{(creator.name || "T").charAt(0)}</Text>
            </View>
          )}
          <Text style={styles.name}>{creator.name}</Text>
          <Text style={styles.meta}>
            {creator.city}, {creator.country} · {creator.specialty}
          </Text>
          <View style={styles.stats}>
            <Stat label="Note" value={`${creator.rating}★`} />
            <Stat label="Modèles" value={String(creator.modelsCount)} />
            <Stat label="Commandes" value={String(creator.ordersCount)} />
            <Stat label="Ans" value={String(creator.yearsExperience)} />
          </View>
        </View>

        <View style={styles.tabs}>
          <TabBtn active={tab === "models"} label="Modèles" onPress={() => setTab("models")} testID="tab-models" />
          <TabBtn active={tab === "bio"} label="Biographie" onPress={() => setTab("bio")} testID="tab-bio" />
        </View>

        {tab === "models" ? (
          <View style={styles.grid}>
            {(models || []).map((m: any) => (
              <View key={m.id} style={styles.card} testID={`creator-model-${m.id}`}>
                <Image source={{ uri: m.image }} style={styles.cardImg} contentFit="cover" />
                <View style={{ padding: 10 }}>
                  <Text style={styles.cardName} numberOfLines={1}>{m.name}</Text>
                  <Text style={styles.cardCat}>{m.category}</Text>
                  <Text style={styles.cardPrice}>{formatXAF(m.indicativePrice)}</Text>
                  <Pressable
                    style={styles.orderMini}
                    disabled={requestSew.isPending}
                    onPress={() => requestSew.mutate(m.id)}
                  >
                    <Text style={styles.orderMiniTxt}>Commander</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
            <Text style={styles.bio}>{creator.bio}</Text>
          </View>
        )}

        {/* Contact card */}
        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>Contacter le créateur</Text>
          <Text style={styles.contactSub}>
            Envoyez un message ou passez une commande de confection (le tailleur est notifié avec sonnerie).
          </Text>
          <TextInput
            testID="chat-input"
            style={styles.input}
            multiline
            numberOfLines={3}
            placeholder="Bonjour, j'aimerais un modèle sur-mesure…"
            placeholderTextColor={colors.muted}
            value={msg}
            onChangeText={setMsg}
          />
          {sent && (
            <Text style={styles.sentBadge} testID="sent-toast">
              Message envoyé ✓
            </Text>
          )}
          {orderSent && (
            <Text style={styles.sentBadge} testID="order-toast">
              Demande de confection envoyée ✓
            </Text>
          )}
          <View style={styles.btnRow}>
            <Pressable
              testID="request-sew"
              style={[styles.orderBtn, requestSew.isPending && { opacity: 0.5 }]}
              disabled={requestSew.isPending}
              onPress={() => requestSew.mutate(undefined)}
            >
              {requestSew.isPending ? (
                <ActivityIndicator color={colors.brandPrimary} />
              ) : (
                <Text style={styles.orderBtnTxt}>Commander</Text>
              )}
            </Pressable>
            <Pressable
              testID="send-msg"
              style={[styles.sendBtn, styles.sendBtnFlex, !msg && { opacity: 0.5 }]}
              disabled={!msg || send.isPending}
              onPress={() => send.mutate(msg)}
            >
              {send.isPending ? (
                <ActivityIndicator color={colors.onBrandPrimary} />
              ) : (
                <>
                  <Text style={styles.sendText}>Message</Text>
                  <Icon name="send" size={14} color={colors.onBrandPrimary} />
                </>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <SafetyActionsModal
        visible={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        userId={creator.userId || id}
        targetType="creator"
        targetId={String(id)}
        targetLabel={creator.name}
        onBlocked={() => router.back()}
      />
    </KeyboardAvoidingView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontWeight: "500", color: colors.onSurface, fontSize: 15 }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function TabBtn({ active, label, onPress, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  headerBlock: { alignItems: "center", padding: 20, marginTop: -60 },
  avatar: {
    width: 100, height: 100, borderRadius: 999,
    borderWidth: 3, borderColor: colors.surface,
  },
  name: { fontSize: 22, fontWeight: "500", color: colors.onSurface, marginTop: 12, letterSpacing: -0.5 },
  meta: { color: colors.muted, marginTop: 4, fontSize: 13 },
  stats: {
    flexDirection: "row", marginTop: 16, width: "100%",
    padding: 12, borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1, borderColor: colors.border,
  },
  tabs: {
    flexDirection: "row", marginHorizontal: 20, marginTop: 12,
    padding: 4, backgroundColor: colors.surfaceSecondary, borderRadius: 12,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabBtnActive: { backgroundColor: colors.surface },
  tabText: { color: colors.muted, fontWeight: "500", fontSize: 13 },
  tabTextActive: { color: colors.onSurface },
  grid: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
    paddingHorizontal: 20, paddingTop: 16,
  },
  card: {
    width: "48%", borderRadius: 12, overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1, borderColor: colors.border,
  },
  cardImg: { width: "100%", height: 180 },
  cardName: { fontSize: 13, fontWeight: "500", color: colors.onSurface },
  cardCat: { fontSize: 11, color: colors.muted, marginTop: 2 },
  cardPrice: { fontSize: 13, fontWeight: "500", color: colors.brandSecondary, marginTop: 4 },
  bio: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  contactCard: {
    marginHorizontal: 20, marginTop: 24, padding: 16,
    borderRadius: 12, backgroundColor: colors.surfaceSecondary,
  },
  contactTitle: { fontSize: 16, fontWeight: "500", color: colors.onSurface },
  contactSub: { color: colors.muted, fontSize: 12, marginTop: 4, marginBottom: 12 },
  input: {
    backgroundColor: colors.surface, borderRadius: 12,
    padding: 12, minHeight: 80, textAlignVertical: "top",
    fontSize: 14, color: colors.onSurface,
    borderWidth: 1, borderColor: colors.border,
  },
  sentBadge: { color: colors.success, marginTop: 8, fontWeight: "500", fontSize: 13 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  orderBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  orderBtnTxt: { color: colors.brandPrimary, fontWeight: "600", fontSize: 13 },
  sendBtn: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 12,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  sendBtnFlex: { flex: 1 },
  sendText: { color: colors.onBrandPrimary, fontWeight: "500", fontSize: 13 },
  orderMini: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.brandPrimary,
  },
  orderMiniTxt: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "600" },
});
