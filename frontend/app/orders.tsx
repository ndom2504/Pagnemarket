import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, formatXAF } from "@/src/api";
import { Icon } from "@/src/icon";
import { PAYMENT_LABEL, statusOf } from "@/src/order-status";
import { colors } from "@/src/theme";

export default function Orders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => api("/orders"), refetchInterval: 20000 });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="orders-back" style={styles.iconBtn} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Mes commandes</Text>
        <View style={{ width: 40 }} />
      </View>

      {orders.isLoading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.brandPrimary} />
      ) : (
        <FlatList
          data={(orders.data as any[]) || []}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          onRefresh={() => orders.refetch()}
          refreshing={orders.isRefetching}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="package" size={28} color={colors.muted} />
              <Text style={styles.emptyTxt}>Aucune commande pour l'instant.</Text>
            </View>
          }
          renderItem={({ item: o }) => {
            const st = statusOf(o.status);
            return (
              <Pressable
                testID={`orders-item-${o.id}`}
                style={styles.row}
                onPress={() => router.push(`/order/${o.id}`)}
              >
                <View style={styles.thumbs}>
                  {o.items.slice(0, 2).map((it: any, i: number) => (
                    <Image
                      key={it.productId}
                      source={{ uri: it.image }}
                      style={[styles.thumb, i === 1 && styles.thumb2]}
                      contentFit="cover"
                    />
                  ))}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {o.items[0]?.name}
                    {o.items.length > 1 ? ` +${o.items.length - 1}` : ""}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {formatXAF(o.total)} · {PAYMENT_LABEL[o.paymentMethod] || o.paymentMethod} ·{" "}
                    {new Date(o.createdAt).toLocaleDateString("fr-FR")}
                  </Text>
                  <View style={[styles.pill, { backgroundColor: st.color }]}>
                    <Text style={styles.pillTxt}>{st.label}</Text>
                  </View>
                </View>
                <Icon name="chevron-right" size={18} color={colors.muted} />
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
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 999, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "500", color: colors.onSurface },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12,
    backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border,
  },
  thumbs: { width: 64, height: 64 },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: colors.surfaceSecondary, position: "absolute", top: 0, left: 0 },
  thumb2: { top: 8, left: 8, borderWidth: 2, borderColor: colors.surfaceTertiary },
  rowTitle: { fontSize: 14, fontWeight: "500", color: colors.onSurface },
  rowMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  pill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 6 },
  pillTxt: { color: colors.onSurfaceInverse, fontSize: 10, fontWeight: "500" },
  empty: { alignItems: "center", padding: 32, gap: 12, marginTop: 40 },
  emptyTxt: { color: colors.muted, fontSize: 13 },
});
