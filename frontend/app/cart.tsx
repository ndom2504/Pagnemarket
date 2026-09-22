import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, formatXAF } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Icon } from "@/src/icon";
import { requireAuth } from "@/src/require-auth";
import { colors } from "@/src/theme";

export default function Cart() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["cart"],
    queryFn: () => api("/cart"),
    enabled: !!user,
  });

  const update = useMutation({
    mutationFn: (v: { productId: string; quantity: number }) =>
      api("/cart/update", { method: "POST", body: JSON.stringify(v) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable testID="cart-back" style={styles.iconBtn} onPress={() => router.back()}>
            <Icon name="arrow-left" size={20} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Mon panier</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <Icon name="shopping-bag" size={36} color={colors.muted} />
          <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "600", textAlign: "center" }}>
            Connectez-vous pour voir votre panier
          </Text>
          <Pressable
            testID="cart-login"
            style={styles.cta}
            onPress={() => requireAuth(null, router)}
          >
            <Text style={styles.ctaText}>Se connecter</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (q.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  const items = ((q.data as any)?.items || []) as any[];
  const total = (q.data as any)?.total || 0;
  const shipping = items.length ? 2500 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="cart-back" style={styles.iconBtn} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Mon panier</Text>
        <View style={{ width: 40 }} />
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="shopping-bag" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>Votre panier est vide</Text>
          <Text style={styles.emptySub}>
            Ajoutez des tissus depuis la boutique pour commencer.
          </Text>
          <Pressable
            testID="explore-fabrics"
            style={styles.cta}
            onPress={() => router.replace("/(tabs)/shop")}
          >
            <Text style={styles.ctaText}>Explorer les tissus</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 200 }}
          >
            {items.map((it: any, idx: number) => {
              const p = it.product;
              return (
                <View key={p.id + idx} style={styles.item} testID={`cart-item-${p.id}`}>
                  <Image source={{ uri: p.images?.[0] }} style={styles.itemImg} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.itemVendor}>{p.supplierName}</Text>
                    <Text style={styles.itemPrice}>{formatXAF(it.lineTotal)}</Text>
                    <View style={styles.qtyRow}>
                      <Pressable
                        testID={`dec-${p.id}`}
                        style={styles.qtyBtn}
                        onPress={() =>
                          update.mutate({ productId: p.id, quantity: it.quantity - 1 })
                        }
                      >
                        <Icon name="minus" size={12} color={colors.onSurface} />
                      </Pressable>
                      <Text style={styles.qtyTxt}>{it.quantity}</Text>
                      <Pressable
                        testID={`inc-${p.id}`}
                        style={styles.qtyBtn}
                        onPress={() =>
                          update.mutate({ productId: p.id, quantity: it.quantity + 1 })
                        }
                      >
                        <Icon name="plus" size={12} color={colors.onSurface} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.sumRow}>
              <Text style={styles.sumLbl}>Sous-total</Text>
              <Text style={styles.sumVal}>{formatXAF(total)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLbl}>Livraison</Text>
              <Text style={styles.sumVal}>{formatXAF(shipping)}</Text>
            </View>
            <View style={[styles.sumRow, { marginTop: 4 }]}>
              <Text style={styles.totalLbl}>Total</Text>
              <Text style={styles.totalVal}>{formatXAF(total + shipping)}</Text>
            </View>
            <Pressable
              testID="checkout-btn"
              style={styles.checkoutBtn}
              onPress={() => router.push("/checkout")}
            >
              <Text style={styles.checkoutText}>Passer commande</Text>
              <Icon name="arrow-right" size={16} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "500", color: colors.onSurface },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "500", color: colors.onSurface, marginTop: 8 },
  emptySub: { color: colors.muted, fontSize: 13, textAlign: "center", marginBottom: 16 },
  cta: {
    backgroundColor: colors.brandPrimary, paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 999,
  },
  ctaText: { color: colors.onBrandPrimary, fontWeight: "500" },
  item: {
    flexDirection: "row", gap: 12, padding: 12,
    borderRadius: 12, backgroundColor: colors.surfaceTertiary,
    borderWidth: 1, borderColor: colors.border,
  },
  itemImg: { width: 80, height: 100, borderRadius: 8 },
  itemName: { fontSize: 14, fontWeight: "500", color: colors.onSurface },
  itemVendor: { fontSize: 11, color: colors.muted, marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: "500", color: colors.brandSecondary, marginTop: 4 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  qtyBtn: {
    width: 26, height: 26, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface,
  },
  qtyTxt: { fontSize: 14, fontWeight: "500", color: colors.onSurface, minWidth: 20, textAlign: "center" },
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider,
    padding: 16, gap: 6,
  },
  sumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sumLbl: { color: colors.muted, fontSize: 13 },
  sumVal: { color: colors.onSurface, fontSize: 13, fontWeight: "500" },
  totalLbl: { color: colors.onSurface, fontSize: 15, fontWeight: "500" },
  totalVal: { color: colors.onSurface, fontSize: 18, fontWeight: "500" },
  checkoutBtn: {
    backgroundColor: colors.brandPrimary,
    marginTop: 12, paddingVertical: 14, borderRadius: 999,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  checkoutText: { color: colors.onBrandPrimary, fontWeight: "500", fontSize: 15 },
});
