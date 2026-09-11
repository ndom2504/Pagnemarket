import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { useAuth } from "@/src/auth";
import { CityPicker } from "@/src/components/city-picker";
import { CountryPicker } from "@/src/components/country-picker";
import { ALL_COUNTRIES, countryByName, type Country } from "@/src/countries";
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

const USAGE = [
  { id: "all", label: "Tous usages" },
  { id: "femme", label: "Femme" },
  { id: "homme", label: "Homme" },
  { id: "enfant", label: "Enfant" },
  { id: "mariage", label: "Mariage" },
  { id: "ceremonie", label: "Cérémonie" },
  { id: "traditionnel", label: "Traditionnel" },
  { id: "business", label: "Business" },
  { id: "haute-couture", label: "Haute couture" },
];

export default function Shop() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ category?: string }>();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>(params.category || "all");
  const [usage, setUsage] = useState("all");
  const [sort, setSort] = useState<string>("recent");
  const [country, setCountry] = useState<Country>(ALL_COUNTRIES);
  const [city, setCity] = useState("all");
  const [countryReady, setCountryReady] = useState(false);

  useEffect(() => {
    if (countryReady || !user) return;
    if (user.country) {
      setCountry(countryByName(user.country));
      if (user.city) setCity(user.city);
    }
    setCountryReady(true);
  }, [user, countryReady]);

  useEffect(() => {
    if (params.category) setCat(String(params.category));
  }, [params.category]);

  const countryParam = country.iso === "ALL" ? "all" : country.name;
  const cityParam = country.iso === "ALL" || city === "all" ? "all" : city;
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api("/categories") });
  const products = useQuery({
    queryKey: ["products", cat, q, sort, countryParam, cityParam, usage],
    queryFn: () =>
      api(
        `/products?category=${cat}&q=${encodeURIComponent(q)}&sort=${
          sort === "recent" ? "" : sort
        }&country=${encodeURIComponent(countryParam)}&city=${encodeURIComponent(cityParam)}&usage=${encodeURIComponent(usage)}`
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

        <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6, gap: 8 }}>
          <CountryPicker
            compact
            allowAll
            value={country}
            onChange={(c) => {
              setCountry(c);
              setCity("all");
            }}
            testID="shop-country"
          />
          {country.iso !== "ALL" && (
            <CityPicker
              compact
              allowAll
              countryIso={country.iso}
              value={city === "all" ? "" : city}
              onChange={setCity}
              placeholder="Toutes les villes"
              testID="shop-city"
            />
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingVertical: 4 }}
        >
          {USAGE.map((u) => (
            <Pressable
              key={u.id}
              testID={`usage-${u.id}`}
              onPress={() => setUsage(u.id)}
              style={[styles.sortChip, usage === u.id && styles.sortChipActive]}
            >
              <Text style={[styles.sortChipText, usage === u.id && styles.sortChipTextActive]}>{u.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

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
          <Text style={styles.emptyTxt}>
            {country.iso === "ALL"
              ? "La boutique est vide. Un fournisseur peut y publier ses tissus."
              : cityParam !== "all"
                ? `Aucun tissu à ${city}, ${country.name}. Essayez toutes les villes ou un autre pays.`
                : `Aucun tissu pour ${country.name}. Changez de pays ou choisissez « Tous les pays ».`}
          </Text>
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
                <Text style={styles.cardVendor}>
                  {item.supplierName}
                  {item.location ? ` · ${item.location}` : item.country ? ` · ${item.country}` : ""}
                </Text>
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
  emptyTxt: { color: colors.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
