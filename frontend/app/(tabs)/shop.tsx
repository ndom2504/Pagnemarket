import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, formatXAF } from "@/src/api";
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

export default function Shop() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>(params.category || "all");
  const [sort, setSort] = useState<string>("recent");

  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api("/categories") });
  const products = useQuery({
    queryKey: ["products", cat, q, sort],
    queryFn: () =>
      api(
        `/products?category=${cat}&q=${encodeURIComponent(q)}&sort=${
          sort === "recent" ? "" : sort
        }`
      ),
  });

  const chips = useMemo(
    () => [{ slug: "all", name: "Tout" }, ...((categories.data as any[]) || [])],
    [categories.data]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Boutique</Text>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Icon name="search" size={16} color={colors.muted} />
            <TextInput
              testID="search-input"
              placeholder="Rechercher un tissu…"
              placeholderTextColor={colors.muted}
              value={q}
              onChangeText={setQ}
              style={styles.searchInput}
            />
          </View>
          <Pressable
            testID="cart-btn"
            onPress={() => router.push("/cart")}
            style={styles.cartBtn}
          >
            <Icon name="shopping-bag" size={18} color={colors.onBrandPrimary} />
          </Pressable>
        </View>

        <FlatList
          horizontal
          data={chips}
          keyExtractor={(i: any) => i.slug}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          style={{ maxHeight: 56 }}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }: any) => {
            const active = cat === item.slug;
            return (
              <Pressable
                testID={`chip-${item.slug}`}
                onPress={() => setCat(item.slug)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item.name}
                </Text>
              </Pressable>
            );
          }}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingVertical: 4 }}
        >
          {[
            { k: "recent", label: "Nouveauté" },
            { k: "price_asc", label: "Prix ↑" },
            { k: "price_desc", label: "Prix ↓" },
            { k: "rating", label: "Mieux notés" },
          ].map((s) => (
            <Pressable
              key={s.k}
              testID={`sort-${s.k}`}
              onPress={() => setSort(s.k)}
              style={[styles.sortChip, sort === s.k && styles.sortChipActive]}
            >
              <Text
                style={[styles.sortChipText, sort === s.k && styles.sortChipTextActive]}
              >
                {s.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {products.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : products.data && (products.data as any[]).length === 0 ? (
        <View style={styles.empty}>
          <Icon name="package" size={48} color={colors.muted} />
          <Text style={styles.emptyTxt}>La boutique est vide. Un fournisseur peut y publier ses tissus.</Text>
        </View>
      ) : (
        <FlatList
          data={products.data as any[]}
          keyExtractor={(i) => i.id}
          numColumns={2}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
          columnWrapperStyle={{ gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              testID={`shop-product-${item.id}`}
              style={styles.card}
              onPress={() => router.push(`/product/${item.id}`)}
            >
              <Image source={{ uri: item.images?.[0] }} style={styles.cardImg} contentFit="cover" />
              {item.promoPrice && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>-15%</Text>
                </View>
              )}
              <View style={{ padding: 10 }}>
                <Text numberOfLines={1} style={styles.cardName}>
                  {item.name}
                </Text>
                <Text style={styles.cardVendor}>{item.supplierName}</Text>
                <View style={styles.cardBottom}>
                  <Text style={styles.cardPrice}>
                    {formatXAF(item.promoPrice || item.price)}
                  </Text>
                  <View style={styles.rating}>
                    <Icon name="star" size={11} color={colors.brandTertiary} />
                    <Text style={styles.ratingTxt}>{item.rating}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: { fontSize: 28, fontWeight: "500", color: colors.onSurface, marginBottom: 12, letterSpacing: -0.5 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 44,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.onSurface },
  cartBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
  },
  chipActive: {
    backgroundColor: colors.surfaceInverse,
    borderColor: colors.surfaceInverse,
  },
  chipText: { color: colors.onSurface, fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: colors.onSurfaceInverse },
  sortChip: {
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  sortChipActive: { backgroundColor: colors.surfaceSecondary },
  sortChipText: { color: colors.muted, fontSize: 12, fontWeight: "500" },
  sortChipTextActive: { color: colors.onSurface },
  card: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardImg: { width: "100%", aspectRatio: 0.85 },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: colors.brandSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { color: colors.onBrandSecondary, fontSize: 10, fontWeight: "500" },
  cardName: { fontSize: 13, fontWeight: "500", color: colors.onSurface },
  cardVendor: { fontSize: 11, color: colors.muted, marginTop: 2 },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  cardPrice: { fontWeight: "500", color: colors.onSurface, fontSize: 13 },
  rating: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingTxt: { color: colors.muted, fontSize: 11 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  emptyTxt: { color: colors.muted, fontSize: 14 },
});
