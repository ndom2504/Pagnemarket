import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, formatXAF } from "@/src/api";
import { ReviewSheet } from "@/src/components/review-sheet";
import { Icon } from "@/src/icon";
import { PAYMENT_LABEL, statusOf } from "@/src/order-status";
import { colors } from "@/src/theme";

const STEPS: { key: string; label: string; desc: string; icon: any }[] = [
  { key: "confirmed", label: "Commande confirmée", desc: "Paiement reçu, le fournisseur est prévenu", icon: "check-circle" },
  { key: "processing", label: "En préparation", desc: "Le fournisseur coupe et emballe vos tissus", icon: "scissors" },
  { key: "shipped", label: "Expédiée", desc: "Votre colis est en route", icon: "truck" },
  { key: "delivered", label: "Livrée", desc: "Profitez de vos tissus et laissez un avis", icon: "gift" },
];

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · ${dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function OrderTracking() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reviewItem, setReviewItem] = useState<any | null>(null);

  const q = useQuery({
    queryKey: ["order", id],
    queryFn: () => api(`/orders/${id}`),
    refetchInterval: 15000,
  });
  const o: any = q.data;

  const history: any[] = o?.statusHistory || [];
  const reached = (key: string) => history.find((h) => h.status === key);
  const currentIdx = o ? STEPS.findIndex((s) => s.key === o.status) : -1;
  const cancelled = o?.status === "cancelled";
  const pendingPay = o?.status === "pending_payment";
  const st = o ? statusOf(o.status) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="order-back" style={styles.iconBtn} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>Suivi de commande</Text>
          {o && <Text style={styles.subtitle}>N° {o.id.slice(0, 8).toUpperCase()}</Text>}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {q.isLoading || !o ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.brandPrimary} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}
          showsVerticalScrollIndicator={false}
          testID="order-tracking"
        >
          {/* Status hero */}
          <View style={[styles.hero, { backgroundColor: st!.color }]}>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTxt}>SUIVI EN DIRECT</Text>
            </View>
            <Text style={styles.heroTitle} testID="order-status-title">{st!.label}</Text>
            <Text style={styles.heroSub}>
              {cancelled
                ? "Cette commande a été annulée."
                : pendingPay
                ? "En attente de la confirmation du paiement (carte ou Mobile Money)."
                : STEPS[currentIdx]?.desc}
            </Text>
          </View>

          {/* Timeline */}
          {!cancelled && (
            <View style={styles.card}>
              {STEPS.map((s, i) => {
                const h = reached(s.key);
                const done = !!h || (currentIdx >= i && !pendingPay);
                const active = currentIdx === i;
                const last = i === STEPS.length - 1;
                return (
                  <View key={s.key} style={styles.stepRow} testID={`step-${s.key}`}>
                    <View style={styles.stepRail}>
                      <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
                        <Icon name={s.icon} size={14} color={done ? colors.onBrandPrimary : colors.muted} />
                      </View>
                      {!last && <View style={[styles.stepLine, done && currentIdx > i && styles.stepLineDone]} />}
                    </View>
                    <View style={{ flex: 1, paddingBottom: last ? 0 : 20 }}>
                      <Text style={[styles.stepLbl, !done && { color: colors.muted }]}>{s.label}</Text>
                      <Text style={styles.stepDesc}>{h ? fmtDate(h.at) : done ? "" : "À venir"}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Items */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {o.items.length} article{o.items.length > 1 ? "s" : ""} · {formatXAF(o.total)}
            </Text>
            {o.items.map((it: any) => {
              const my = o.myReviews?.[it.productId];
              return (
                <View key={it.productId} style={styles.itemRow} testID={`order-item-${it.productId}`}>
                  <Image source={{ uri: it.image }} style={styles.itemImg} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.itemName}>{it.name}</Text>
                    <Text style={styles.itemMeta}>
                      {it.quantity} × {formatXAF(it.price)} · {it.supplierName}
                    </Text>
                    {o.status === "delivered" &&
                      (my ? (
                        <View style={styles.myReview} testID={`my-review-${it.productId}`}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Icon key={n} name="star" size={12} color={n <= my.rating ? colors.brandTertiary : colors.border} />
                          ))}
                          <Text style={styles.myReviewTxt}>Votre avis</Text>
                        </View>
                      ) : (
                        <Pressable
                          testID={`rate-${it.productId}`}
                          style={styles.rateBtn}
                          onPress={() => setReviewItem(it)}
                        >
                          <Icon name="star" size={12} color={colors.onBrandSecondary} />
                          <Text style={styles.rateTxt}>Noter ce tissu</Text>
                        </Pressable>
                      ))}
                  </View>
                  <Pressable onPress={() => router.push(`/product/${it.productId}`)} style={styles.itemLink}>
                    <Icon name="chevron-right" size={18} color={colors.muted} />
                  </Pressable>
                </View>
              );
            })}
          </View>

          {/* Delivery & payment */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Livraison & paiement</Text>
            <InfoRow icon="map-pin" txt={`${o.address}, ${o.city}, ${o.country}`} />
            <InfoRow icon="phone" txt={o.phone} />
            <InfoRow icon="credit-card" txt={`${PAYMENT_LABEL[o.paymentMethod] || o.paymentMethod} · ${o.paymentStatus === "paid" ? "Payé" : o.paymentStatus === "pending" ? "En attente" : "Échoué"}`} />
            <InfoRow icon="calendar" txt={`Commandé le ${fmtDate(o.createdAt)}`} />
          </View>
        </ScrollView>
      )}

      <ReviewSheet item={reviewItem} orderId={id!} onClose={() => setReviewItem(null)} />
    </View>
  );
}

function InfoRow({ icon, txt }: { icon: any; txt: string }) {
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={14} color={colors.muted} />
      <Text style={styles.infoTxt}>{txt}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 999, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "500", color: colors.onSurface },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  hero: { borderRadius: 16, padding: 20 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.onSurfaceInverse },
  liveTxt: { color: colors.onSurfaceInverse, opacity: 0.8, fontSize: 11, letterSpacing: 1.2, fontWeight: "500" },
  heroTitle: { color: colors.onSurfaceInverse, fontSize: 26, fontWeight: "500", letterSpacing: -0.5 },
  heroSub: { color: colors.onSurfaceInverse, opacity: 0.85, fontSize: 13, marginTop: 6, lineHeight: 18 },
  card: {
    backgroundColor: colors.surfaceTertiary, borderRadius: 16, padding: 16, gap: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: "500", color: colors.onSurface },
  stepRow: { flexDirection: "row", gap: 14 },
  stepRail: { alignItems: "center", width: 32 },
  stepDot: {
    width: 32, height: 32, borderRadius: 999, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  stepDotDone: { backgroundColor: colors.brandPrimary },
  stepDotActive: { backgroundColor: colors.brandSecondary },
  stepLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 4 },
  stepLineDone: { backgroundColor: colors.brandPrimary },
  stepLbl: { fontSize: 14, fontWeight: "500", color: colors.onSurface, marginTop: 6 },
  stepDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  itemImg: { width: 56, height: 56, borderRadius: 10, backgroundColor: colors.surfaceSecondary },
  itemName: { fontSize: 13, fontWeight: "500", color: colors.onSurface },
  itemMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  itemLink: { padding: 6 },
  rateBtn: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
    backgroundColor: colors.brandSecondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  rateTxt: { color: colors.onBrandSecondary, fontSize: 12, fontWeight: "500" },
  myReview: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 8 },
  myReviewTxt: { fontSize: 11, color: colors.muted, marginLeft: 6 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoTxt: { flex: 1, fontSize: 13, color: colors.onSurface },
});
