import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
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
import { categoryImageSource } from "@/src/category-images";
import { HeroCategoryBackdrop } from "@/src/components/hero-category-backdrop";
import { NotificationBell } from "@/src/components/notification-bell";
import { mediaUrl, cardPreviewUrl } from "@/src/media";
import { colors } from "@/src/theme";

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api("/categories") });
  const trending = useQuery({
    queryKey: ["trending", user?.country],
    queryFn: () =>
      api(
        user?.country
          ? `/products/trending?country=${encodeURIComponent(user.country)}`
          : "/products/trending"
      ),
  });
  const creators = useQuery({
    queryKey: ["creators", user?.country],
    queryFn: () =>
      api(
        user?.country
          ? `/creators?country=${encodeURIComponent(user.country)}`
          : "/creators"
      ),
  });
  const suppliers = useQuery({
    queryKey: ["suppliers", user?.country],
    queryFn: () =>
      api(
        user?.country
          ? `/suppliers?country=${encodeURIComponent(user.country)}`
          : "/suppliers"
      ),
  });
  const models = useQuery({ queryKey: ["models"], queryFn: () => api("/models") });
  const reco = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => api("/recommendations"),
    enabled: !!user,
  });
  const recoItems: any[] = (reco.data as any)?.items || [];
  const recoBasis = (reco.data as any)?.basis;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
      testID="home-screen"
    >
      {/* Hero */}
      <View style={styles.hero}>
        <HeroCategoryBackdrop />
        <LinearGradient
          colors={["rgba(17,17,17,0.35)", "rgba(17,17,17,0.55)", "rgba(17,17,17,0.88)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroTop, { paddingTop: insets.top + 12 }]}>
          <View style={styles.brandRow}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={styles.brandLogo}
              contentFit="contain"
            />
            <Text style={styles.brand}>PagneMarket</Text>
          </View>
          <View style={styles.heroActions}>
            {user ? <NotificationBell light testID="home-notif-bell" /> : null}
            <Pressable
              testID="header-search"
              onPress={() => router.push("/(tabs)/shop")}
              style={styles.iconBtn}
            >
              <Icon name="search" color={colors.onSurfaceInverse} size={20} />
            </Pressable>
          </View>
        </View>
        <View style={styles.heroBottom}>
          <Text style={styles.heroTitle}>Le pagne africain{"\n"}partout dans le monde.</Text>
          <Text style={styles.heroSub}>
            Vous choisissez un motif de tissu, commandez avec le fournisseur, imaginez un modèle avec notre outil IA et faites-le coudre avec un tailleur.
          </Text>
          <View style={styles.heroCtas}>
            <Pressable
              testID="cta-shop"
              style={styles.primaryCta}
              onPress={() => router.push("/(tabs)/shop")}
            >
              <Text style={styles.primaryCtaText}>Trouver une boutique</Text>
              <Icon name="arrow-right" size={16} color={colors.onBrandPrimary} />
            </Pressable>
            <Pressable
              testID="cta-models"
              style={styles.ghostCta}
              onPress={() => router.push("/(tabs)/models")}
            >
              <Text style={styles.ghostCtaText}>Voir nos tailleurs</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Categories */}
      <SectionTitle title="Types de pagne" />
      {categories.isLoading ? (
        <ActivityIndicator style={{ marginVertical: 24 }} color={colors.brandPrimary} />
      ) : (
        <FlatList
          horizontal
          data={((categories.data as any[]) || []).filter((c) => categoryImageSource(c))}
          keyExtractor={(i: any) => i.id}
          contentContainerStyle={styles.chipsRow}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }: any) => {
            const img = categoryImageSource(item);
            return (
              <Pressable
                testID={`category-${item.slug || item.id}`}
                style={styles.catWrap}
                onPress={() => router.push(`/(tabs)/shop?category=${item.slug || item.id}`)}
              >
                <View style={styles.catCard}>
                  <Image
                    source={img!}
                    style={styles.catImage}
                    contentFit="cover"
                    recyclingKey={`cat-${item.slug || item.id}`}
                  />
                </View>
                <Text numberOfLines={2} style={styles.catTitle}>
                  {item.name}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      {/* For you */}
      {recoItems.length > 0 && (
        <>
          <SectionTitle
            title="Pour vous"
            subtitle={
              recoBasis?.topCategory
                ? `Inspiré de vos ${recoBasis.favorites ? "favoris" : "visites"} · ${recoBasis.topCategory}`
                : "Basé sur vos favoris et vos visites"
            }
          />
          <FlatList
            horizontal
            data={recoItems}
            keyExtractor={(i: any) => i.id}
            contentContainerStyle={styles.chipsRow}
            showsHorizontalScrollIndicator={false}
            testID="for-you-row"
            renderItem={({ item }: any) => (
              <Pressable
                testID={`for-you-${item.id}`}
                style={styles.recoCard}
                onPress={() => router.push(`/product/${item.id}`)}
              >
                <Image source={{ uri: item.images?.[0] }} style={styles.recoImg} contentFit="cover" />
                <LinearGradient
                  colors={["transparent", "rgba(17,17,17,0.9)"]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.recoTag}>
                  <Icon name="zap" size={10} color={colors.onBrandTertiary} />
                  <Text style={styles.recoTagTxt}>Pour vous</Text>
                </View>
                <View style={styles.recoInfo}>
                  <Text numberOfLines={1} style={styles.recoName}>{item.name}</Text>
                  <Text style={styles.recoMeta}>
                    {item.supplierName}
                    {item.location ? ` · ${item.location}` : ""}
                  </Text>
                  <Text style={styles.recoPrice}>{formatXAF(item.promoPrice || item.price)}</Text>
                </View>
              </Pressable>
            )}
          />
        </>
      )}

      {/* Trending */}
      <SectionTitle title="Tendances du moment" action="Voir tout" onAction={() => router.push("/(tabs)/shop")} />
      {trending.isLoading ? (
        <ActivityIndicator style={{ marginVertical: 24 }} color={colors.brandPrimary} />
      ) : !(trending.data as any[])?.length ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
            Aucun tissu pour l'instant. Inscrivez-vous en fournisseur pour publier vos pagnes, ou en client pour acheter dès qu'ils apparaissent.
          </Text>
        </View>
      ) : (
        <FlatList
          horizontal
          data={trending.data || []}
          keyExtractor={(i: any) => i.id}
          contentContainerStyle={styles.chipsRow}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }: any) => (
            <Pressable
              testID={`trending-${item.id}`}
              style={styles.prodCard}
              onPress={() => router.push(`/product/${item.id}`)}
            >
              <Image source={{ uri: item.images?.[0] }} style={styles.prodImg} contentFit="cover" />
              {item.promoPrice && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>-15%</Text>
                </View>
              )}
              <View style={{ padding: 12 }}>
                <Text numberOfLines={1} style={styles.prodName}>{item.name}</Text>
                <Text style={styles.prodVendor}>
                  {item.supplierName}
                  {item.location ? ` · ${item.location}` : ""}
                </Text>
                <View style={styles.prodBottom}>
                  <Text style={styles.prodPrice}>{formatXAF(item.promoPrice || item.price)}</Text>
                  <View style={styles.rating}>
                    <Icon name="star" size={12} color={colors.brandTertiary} />
                    <Text style={styles.ratingTxt}>{item.rating}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Creators */}
      {!!(creators.data as any[])?.length && (
      <>
      <SectionTitle title="Tailleurs" subtitle="Ils cousent le tissu que vous choisissez." />
      <FlatList
        horizontal
        data={creators.data || []}
        keyExtractor={(i: any) => i.id}
        contentContainerStyle={styles.chipsRow}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }: any) => {
          const preview = cardPreviewUrl(item.cardImage, item.cover, item.previewImage, item.avatar);
          const avatar = mediaUrl(item.avatar);
          return (
            <Pressable
              testID={`creator-${item.id}`}
              style={styles.creatorCard}
              onPress={() => router.push(`/creator/${item.id}`)}
            >
              {preview ? (
                <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.cardFallback]} />
              )}
              <LinearGradient
                colors={["transparent", "rgba(17,17,17,0.92)"]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.creatorInfo}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.creatorAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.creatorAvatar, styles.avatarLetter]}>
                    <Text style={styles.avatarLetterTxt}>{(item.name || "T").charAt(0)}</Text>
                  </View>
                )}
                <Text style={styles.creatorName}>{item.name}</Text>
                <Text style={styles.creatorMeta}>
                  {[item.city, item.country].filter(Boolean).join(", ")}
                  {item.specialty ? ` · ${item.specialty}` : ""}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
      </>
      )}

      {/* Suppliers */}
      {!!(suppliers.data as any[])?.length && (
      <>
      <SectionTitle title="Fournisseurs" subtitle="Découvrez leurs tissus et leur boutique." action="Boutique" onAction={() => router.push("/(tabs)/shop")} />
      <FlatList
        horizontal
        data={suppliers.data || []}
        keyExtractor={(i: any) => i.id}
        contentContainerStyle={styles.chipsRow}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }: any) => {
          const preview = cardPreviewUrl(item.cardImage, item.shopCover, item.previewImage, item.avatar);
          const avatar = mediaUrl(item.avatar);
          return (
            <Pressable
              testID={`supplier-${item.id}`}
              style={styles.creatorCard}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/shop",
                  params: { supplierId: item.id, supplierName: item.shopName },
                } as any)
              }
            >
              {preview ? (
                <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.cardFallback]} />
              )}
              <LinearGradient
                colors={["transparent", "rgba(17,17,17,0.92)"]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.creatorInfo}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.creatorAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.creatorAvatar, styles.avatarLetter]}>
                    <Text style={styles.avatarLetterTxt}>{(item.shopName || "F").charAt(0)}</Text>
                  </View>
                )}
                <Text style={styles.creatorName}>{item.shopName}</Text>
                <Text style={styles.creatorMeta}>
                  {[item.city, item.country].filter(Boolean).join(", ")}
                  {item.productsCount ? ` · ${item.productsCount} tissus` : ""}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
      </>
      )}

      {!!(models.data as any[])?.length && (
      <>
      <SectionTitle title="Inspirations à coudre" action="Voir tout" onAction={() => router.push("/(tabs)/models")} />
      <View style={styles.modelsGrid}>
        {(models.data || []).slice(0, 4).map((m: any) => (
          <Pressable
            key={m.id}
            testID={`model-${m.id}`}
            style={styles.modelCard}
            onPress={() => router.push(`/creator/${m.creatorId}`)}
          >
            <Image source={{ uri: m.image }} style={styles.modelImg} contentFit="cover" />
            <View style={{ padding: 10 }}>
              <Text numberOfLines={1} style={styles.modelName}>{m.name}</Text>
              <Text style={styles.modelMeta}>{m.creatorName}</Text>
              <Text style={styles.modelPrice}>{formatXAF(m.indicativePrice)}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      </>
      )}
    </ScrollView>
  );
}

function SectionTitle({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      </View>
      {action && (
        <Pressable onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 520, backgroundColor: colors.surfaceInverse },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  brand: { color: colors.onSurfaceInverse, fontSize: 22, fontWeight: "500", letterSpacing: -0.5 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#000",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroBottom: { position: "absolute", bottom: 24, left: 20, right: 20 },
  heroTitle: { color: colors.onSurfaceInverse, fontSize: 34, fontWeight: "500", lineHeight: 40, letterSpacing: -1 },
  heroSub: { color: colors.onSurfaceInverse, opacity: 0.85, marginTop: 12, fontSize: 14, lineHeight: 21 },
  heroCtas: { flexDirection: "row", gap: 10, marginTop: 20, flexWrap: "wrap" },
  primaryCta: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryCtaText: { color: colors.onSurface, fontWeight: "500" },
  ghostCta: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  ghostCtaText: { color: colors.onSurfaceInverse, fontWeight: "500" },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 20, fontWeight: "500", color: colors.onSurface, letterSpacing: -0.5 },
  sectionSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  sectionAction: { color: colors.brandSecondary, fontSize: 13, fontWeight: "500" },
  chipsRow: { paddingHorizontal: 20, gap: 12 },
  recoCard: {
    width: 170,
    height: 230,
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: colors.surfaceSecondary,
  },
  recoImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  recoTag: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  recoTagTxt: { color: colors.onBrandTertiary, fontSize: 10, fontWeight: "500" },
  recoInfo: { padding: 12 },
  recoName: { color: colors.onSurfaceInverse, fontSize: 14, fontWeight: "500" },
  recoMeta: { color: colors.onSurfaceInverse, opacity: 0.75, fontSize: 11, marginTop: 2 },
  recoPrice: { color: colors.onSurfaceInverse, fontSize: 13, fontWeight: "500", marginTop: 6 },
  catWrap: {
    width: 148,
    gap: 8,
  },
  catCard: {
    width: 148,
    height: 148,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.surfaceSecondary,
  },
  catImage: {
    width: 148,
    height: 148,
  },
  catTitle: {
    color: colors.onSurface,
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 17,
    paddingHorizontal: 2,
  },
  catFallback: {
    alignItems: "flex-end",
    justifyContent: "flex-end",
    padding: 12,
    backgroundColor: colors.surfaceInverse,
  },
  catName: { color: colors.onSurfaceInverse, fontWeight: "500", fontSize: 14 },
  prodCard: {
    width: 200,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  prodImg: { width: "100%", height: 180 },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: colors.brandSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { color: colors.onBrandSecondary, fontSize: 11, fontWeight: "500" },
  prodName: { fontSize: 14, fontWeight: "500", color: colors.onSurface },
  prodVendor: { fontSize: 12, color: colors.muted, marginTop: 2 },
  prodBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  prodPrice: { fontWeight: "500", color: colors.onSurface, fontSize: 14 },
  rating: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingTxt: { color: colors.muted, fontSize: 12 },
  creatorCard: {
    width: 180,
    height: 240,
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: colors.surfaceInverse,
  },
  cardFallback: { backgroundColor: "#2A2A2A" },
  creatorInfo: { padding: 12 },
  creatorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.onSurfaceInverse,
    marginBottom: 8,
  },
  avatarLetter: {
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetterTxt: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 16 },
  creatorName: { color: colors.onSurfaceInverse, fontSize: 15, fontWeight: "500" },
  creatorMeta: { color: colors.onSurfaceInverse, opacity: 0.8, fontSize: 12, marginTop: 2 },
  modelsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    gap: 12,
  },
  modelCard: {
    width: "48%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modelImg: { width: "100%", height: 200 },
  modelName: { fontSize: 13, fontWeight: "500", color: colors.onSurface },
  modelMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  modelPrice: { fontSize: 13, fontWeight: "500", color: colors.brandSecondary, marginTop: 4 },
});
