import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, formatXAF } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Icon } from "@/src/icon";
import { PAYMENT_LABEL, SUPPLIER_STATUS_FLOW, statusOf } from "@/src/order-status";
import { colors } from "@/src/theme";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export default function SupplierDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [statusFor, setStatusFor] = useState<any | null>(null);

  const stats = useQuery({
    queryKey: ["supplier-stats"],
    queryFn: () => api("/supplier/stats"),
    refetchInterval: 30000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/supplier/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      setStatusFor(null);
      qc.invalidateQueries({ queryKey: ["supplier-stats"] });
      qc.invalidateQueries({ queryKey: ["supplier-orders"] });
    },
  });

  const s: any = stats.data;
  const maxDay = Math.max(1, ...((s?.last7Days || []).map((d: any) => d.revenue) as number[]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="supplier-back" style={styles.iconBtn} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>Espace fournisseur</Text>
          <Text style={styles.subtitle}>{user?.shopName || `${user?.firstName} ${user?.lastName}`}</Text>
        </View>
        <Pressable testID="supplier-products-link" style={styles.iconBtn} onPress={() => router.push("/supplier/products")}>
          <Icon name="grid" size={18} color={colors.onSurface} />
        </Pressable>
      </View>

      {stats.isLoading || !s ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.brandPrimary} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}
          refreshControl={<RefreshControl refreshing={stats.isRefetching} onRefresh={() => stats.refetch()} />}
          showsVerticalScrollIndicator={false}
          testID="supplier-dashboard"
        >
          {/* Hero KPI */}
          <View style={styles.heroCard}>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTxt}>EN DIRECT · AUJOURD'HUI</Text>
            </View>
            <Text style={styles.heroValue} testID="kpi-revenue-today">{formatXAF(s.revenueToday)}</Text>
            <Text style={styles.heroSub}>
              {s.ordersToday} commande{s.ordersToday > 1 ? "s" : ""} aujourd'hui · CA total {formatXAF(s.revenueTotal)}
            </Text>
          </View>

          <View style={styles.kpiRow}>
            <Kpi icon="clock" label="En cours" value={String(s.ordersInProgress)} testID="kpi-in-progress" />
            <Kpi icon="package" label="Commandes" value={String(s.ordersTotal)} testID="kpi-orders" />
            <Kpi
              icon="layers"
              label="Tissus"
              value={String(s.productsCount)}
              hint={s.lowStockCount ? `${s.lowStockCount} stock bas` : undefined}
              testID="kpi-products"
            />
          </View>

          {/* Chart */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ventes des 7 derniers jours</Text>
            <View style={styles.chart}>
              {(s.last7Days || []).map((d: any) => {
                const h = Math.max(4, Math.round((d.revenue / maxDay) * 96));
                const isToday = d === s.last7Days[s.last7Days.length - 1];
                return (
                  <View key={d.date} style={styles.barCol}>
                    <View style={[styles.bar, { height: h }, isToday && styles.barToday]} />
                    <Text style={styles.barLbl}>{DAY_LABELS[new Date(d.date).getDay()]}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Top fabrics */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Top tissus</Text>
              <Icon name="trending-up" size={16} color={colors.brandSecondary} />
            </View>
            {(s.topProducts || []).length === 0 ? (
              <Text style={styles.emptyTxt}>Aucune vente pour le moment.</Text>
            ) : (
              (s.topProducts as any[]).map((t, i) => (
                <View key={t.productId} style={styles.topRow} testID={`top-product-${i}`}>
                  <Text style={styles.rank}>{i + 1}</Text>
                  <Image source={{ uri: t.image }} style={styles.topImg} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.topName}>{t.name}</Text>
                    <Text style={styles.topMeta}>{t.quantity} vendus</Text>
                  </View>
                  <Text style={styles.topRevenue}>{formatXAF(t.revenue)}</Text>
                </View>
              ))
            )}
          </View>

          {/* Recent orders */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Commandes récentes</Text>
            {(s.recentOrders || []).length === 0 ? (
              <Text style={styles.emptyTxt}>Aucune commande.</Text>
            ) : (
              (s.recentOrders as any[]).map((o) => {
                const st = statusOf(o.status);
                return (
                  <Pressable
                    key={o.id}
                    testID={`order-row-${o.id}`}
                    style={styles.orderRow}
                    onPress={() => setStatusFor(o)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderTitle}>
                        {o.customerName} · {formatXAF(o.total)}
                      </Text>
                      <Text style={styles.orderMeta}>
                        {o.items.length} article{o.items.length > 1 ? "s" : ""} · {PAYMENT_LABEL[o.paymentMethod] || o.paymentMethod} ·{" "}
                        {new Date(o.createdAt).toLocaleDateString("fr-FR")}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: st.color }]}>
                      <Text style={styles.statusTxt}>{st.label}</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* FAB */}
      <Pressable
        testID="fab-add-product"
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push("/supplier/product-form")}
      >
        <Icon name="plus" size={18} color={colors.onBrandPrimary} />
        <Text style={styles.fabTxt}>Ajouter un tissu</Text>
      </Pressable>

      {/* Status sheet */}
      <Modal visible={!!statusFor} transparent animationType="fade" onRequestClose={() => setStatusFor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setStatusFor(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Mettre à jour la commande</Text>
            <Text style={styles.sheetSub}>
              {statusFor?.customerName} · {statusFor?.city} · {statusFor?.phone}
            </Text>
            {statusFor?.items?.map((it: any) => (
              <Text key={it.productId} style={styles.sheetItem}>
                {it.quantity} × {it.name}
              </Text>
            ))}
            <View style={{ height: 8 }} />
            {SUPPLIER_STATUS_FLOW.map((st) => {
              const meta = statusOf(st);
              const active = statusFor?.status === st;
              return (
                <Pressable
                  key={st}
                  testID={`status-${st}`}
                  style={[styles.statusOption, active && styles.statusOptionActive]}
                  onPress={() => updateStatus.mutate({ id: statusFor.id, status: st })}
                  disabled={updateStatus.isPending}
                >
                  <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                  <Text style={styles.statusOptionTxt}>{meta.label}</Text>
                  {active && <Icon name="check" size={16} color={colors.brandSecondary} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Kpi({ icon, label, value, hint, testID }: { icon: any; label: string; value: string; hint?: string; testID?: string }) {
  return (
    <View style={styles.kpi} testID={testID}>
      <Icon name={icon} size={16} color={colors.brandSecondary} />
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {hint && <Text style={styles.kpiHint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 999, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "500", color: colors.onSurface },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  heroCard: { backgroundColor: colors.surfaceInverse, borderRadius: 16, padding: 20 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  liveDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.brandSecondary },
  liveTxt: { color: colors.onSurfaceInverse, opacity: 0.7, fontSize: 11, letterSpacing: 1.2, fontWeight: "500" },
  heroValue: { color: colors.onSurfaceInverse, fontSize: 34, fontWeight: "500", letterSpacing: -1 },
  heroSub: { color: colors.onSurfaceInverse, opacity: 0.75, fontSize: 13, marginTop: 6 },
  kpiRow: { flexDirection: "row", gap: 10 },
  kpi: {
    flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: 12, padding: 14, gap: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  kpiValue: { fontSize: 22, fontWeight: "500", color: colors.onSurface, marginTop: 4 },
  kpiLabel: { fontSize: 11, color: colors.muted },
  kpiHint: { fontSize: 10, color: colors.brandSecondary, fontWeight: "500" },
  card: {
    backgroundColor: colors.surfaceTertiary, borderRadius: 16, padding: 16, gap: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: "500", color: colors.onSurface },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 124, paddingTop: 8 },
  barCol: { alignItems: "center", gap: 6, flex: 1 },
  bar: { width: 22, borderRadius: 6, backgroundColor: colors.surfaceSecondary },
  barToday: { backgroundColor: colors.brandSecondary },
  barLbl: { fontSize: 10, color: colors.muted },
  emptyTxt: { color: colors.muted, fontSize: 13 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rank: { width: 18, color: colors.brandTertiary, fontWeight: "500", fontSize: 14 },
  topImg: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.surfaceSecondary },
  topName: { fontSize: 13, fontWeight: "500", color: colors.onSurface },
  topMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  topRevenue: { fontSize: 13, fontWeight: "500", color: colors.onSurface },
  orderRow: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.divider,
  },
  orderTitle: { fontSize: 13, fontWeight: "500", color: colors.onSurface },
  orderMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusTxt: { color: colors.onSurfaceInverse, fontSize: 11, fontWeight: "500" },
  fab: {
    position: "absolute", right: 16, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.brandPrimary, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 999,
  },
  fabTxt: { color: colors.onBrandPrimary, fontWeight: "500", fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(17,17,17,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, gap: 4,
  },
  sheetTitle: { fontSize: 17, fontWeight: "500", color: colors.onSurface },
  sheetSub: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  sheetItem: { fontSize: 13, color: colors.onSurface },
  statusOption: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12,
  },
  statusOptionActive: { backgroundColor: colors.surfaceSecondary },
  statusDot: { width: 10, height: 10, borderRadius: 999 },
  statusOptionTxt: { flex: 1, fontSize: 14, color: colors.onSurface, fontWeight: "500" },
});
