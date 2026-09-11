import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, formatXAF } from "@/src/api";
import { AiLookStudio } from "@/src/components/ai-look-studio";
import { TailorSheet } from "@/src/components/tailor-sheet";
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

export default function ProductDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const [imgIdx, setImgIdx] = useState(0);
  const [fav, setFav] = useState(false);
  const [tailorOpen, setTailorOpen] = useState(false);
  const [tailorGarment, setTailorGarment] = useState<string | undefined>();

  const q = useQuery({ queryKey: ["product", id], queryFn: () => api(`/products/${id}`) });
  const reviews = useQuery({ queryKey: ["reviews", id], queryFn: () => api(`/products/${id}/reviews`, { auth: false }) });
  const reviewList: any[] = (reviews.data as any)?.items || [];
  useEffect(() => {
    if (!id) return;
    api("/events/view", { method: "POST", body: JSON.stringify({ productId: id }) })
      .then(() => qc.invalidateQueries({ queryKey: ["recommendations"] }))
      .catch(() => {});
  }, [id, qc]);
  const addToCart = useMutation({
    mutationFn: () =>
      api("/cart/add", {
        method: "POST",
        body: JSON.stringify({ productId: id, quantity: 1 }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });
  const toggleFav = useMutation({
    mutationFn: () => api("/favorites/toggle", { method: "POST", body: JSON.stringify({ productId: id }) }),
    onSuccess: (r: any) => {
      setFav(!!r.favorited);
      qc.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  if (q.isLoading || !q.data) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  const p: any = q.data;
  const finalPrice = p.promoPrice || p.price;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* Gallery */}
        <View style={{ height: width * 1.1, backgroundColor: colors.surfaceSecondary }}>
          <FlatList
            horizontal
            pagingEnabled
            data={p.images || []}
            keyExtractor={(_, i) => String(i)}
            onMomentumScrollEnd={(e) =>
              setImgIdx(Math.round(e.nativeEvent.contentOffset.x / width))
            }
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={{ width, height: width * 1.1 }} contentFit="cover" />
            )}
          />
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable testID="back-btn" style={styles.iconBtn} onPress={() => router.back()}>
              <Icon name="arrow-left" size={20} color={colors.onSurface} />
            </Pressable>
            <Pressable testID="fav-btn" style={styles.iconBtn} onPress={() => toggleFav.mutate()}>
              <Icon name="heart" size={20} color={fav ? colors.brandSecondary : colors.onSurface} />
            </Pressable>
          </View>
          <View style={styles.dotsRow}>
            {(p.images || []).map((_: any, i: number) => (
              <View key={i} style={[styles.dot, imgIdx === i && styles.dotActive]} />
            ))}
          </View>
        </View>

        <View style={{ padding: 20, gap: 16 }}>
          <View>
            <Text style={styles.category}>{p.category?.toUpperCase()}</Text>
            <Text style={styles.name}>{p.name}</Text>
            <View style={styles.rowBetween}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {p.promoPrice && (
                  <Text style={styles.priceOld}>{formatXAF(p.price)}</Text>
                )}
                <Text style={styles.price}>{formatXAF(finalPrice)}</Text>
              </View>
              <View style={styles.ratingBig}>
                <Icon name="star" size={14} color={colors.brandTertiary} />
                <Text style={styles.ratingBigText}>
                  {p.rating} ({p.reviewsCount})
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.vendorCard}>
            <View style={styles.vendorAvatar}>
              <Text style={{ color: colors.onSurfaceInverse, fontWeight: "500" }}>
                {p.supplierName.charAt(0)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supplierName}>{p.supplierName}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon name="map-pin" size={12} color={colors.muted} />
                <Text style={styles.vendorLoc}>{p.location}</Text>
              </View>
            </View>
            {p.supplierId ? (
              <Pressable
                testID="contact-supplier"
                style={styles.followBtn}
                onPress={() => {
                  api("/messages/send", {
                    method: "POST",
                    body: JSON.stringify({
                      toUserId: p.supplierId,
                      toName: p.supplierName,
                      text: `Bonjour, je suis intéressé(e) par « ${p.name} ».`,
                    }),
                  })
                    .then((msg: any) => {
                      if (msg?.conversationId) router.push(`/conversation/${msg.conversationId}`);
                    })
                    .catch(() => {});
                }}
              >
                <Text style={styles.followText}>Message</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.followBtn}>
                <Text style={styles.followText}>Suivre</Text>
              </Pressable>
            )}
          </View>

          <View>
            <Text style={styles.sectionLbl}>Description</Text>
            <Text style={styles.desc}>{p.description}</Text>
          </View>

          <AiLookStudio
            productId={String(id)}
            productName={p.name}
            onOpenTailors={(g) => {
              setTailorGarment(g);
              setTailorOpen(true);
            }}
            onAddToCart={() => addToCart.mutate()}
          />

          <View style={styles.attrsGrid}>
            <Attr label="Stock" value={p.stock > 0 ? `${p.stock} pièces` : "Rupture"} />
            <Attr label="Origine" value={p.location.split(",")[1]?.trim() || "Afrique"} />
            <Attr label="Catégorie" value={p.category} />
            <Attr label="Devise" value={p.currency} />
          </View>

          {/* Reviews */}
          <View testID="reviews-section">
            <View style={styles.rowBetween}>
              <Text style={styles.sectionLbl}>Avis des acheteurs</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon name="star" size={14} color={colors.brandTertiary} />
                <Text style={styles.ratingBigText}>{p.rating} · {p.reviewsCount} avis</Text>
              </View>
            </View>
            {reviewList.length === 0 ? (
              <Text style={styles.noReview}>
                Pas encore d'avis détaillé. Les acheteurs peuvent noter ce tissu après livraison.
              </Text>
            ) : (
              <View style={{ gap: 10, marginTop: 8 }}>
                {reviewList.slice(0, 5).map((r: any) => (
                  <View key={r.id} style={styles.reviewCard} testID={`review-${r.id}`}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.reviewUser}>{r.userName}</Text>
                      <View style={{ flexDirection: "row", gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Icon key={n} name="star" size={12} color={n <= r.rating ? colors.brandTertiary : colors.border} />
                        ))}
                      </View>
                    </View>
                    {r.comment && <Text style={styles.reviewTxt}>{r.comment}</Text>}
                    <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString("fr-FR")} · Achat vérifié</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
        <BlurView
          intensity={80}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.ctaInner}>
          <Pressable
            testID="add-to-cart"
            style={styles.addCart}
            onPress={() => addToCart.mutate()}
          >
            {addToCart.isPending ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <>
                <Icon name="shopping-bag" size={16} color={colors.onBrandPrimary} />
                <Text style={styles.addCartText}>Ajouter · {formatXAF(finalPrice)}</Text>
              </>
            )}
          </Pressable>
          <Pressable
            testID="buy-now"
            style={styles.buyNow}
            onPress={async () => {
              await addToCart.mutateAsync();
              router.push("/cart");
            }}
          >
            <Text style={styles.buyNowText}>Acheter</Text>
          </Pressable>
        </View>
      </View>

      <TailorSheet
        visible={tailorOpen}
        productName={p.name}
        garment={tailorGarment}
        onClose={() => setTailorOpen(false)}
      />
    </View>
  );
}

function Attr({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.attr}>
      <Text style={styles.attrLbl}>{label}</Text>
      <Text style={styles.attrVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(250,248,243,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  dotsRow: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.6)" },
  dotActive: { backgroundColor: colors.onSurfaceInverse, width: 20 },
  category: { fontSize: 11, color: colors.muted, letterSpacing: 1.5, fontWeight: "500" },
  name: {
    fontSize: 26,
    fontWeight: "500",
    color: colors.onSurface,
    letterSpacing: -0.5,
    marginTop: 6,
    marginBottom: 12,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  price: { fontSize: 22, fontWeight: "500", color: colors.onSurface },
  priceOld: { fontSize: 14, color: colors.muted, textDecorationLine: "line-through" },
  ratingBig: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  ratingBigText: { fontSize: 12, color: colors.onSurface, fontWeight: "500" },
  vendorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vendorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.surfaceInverse,
    alignItems: "center",
    justifyContent: "center",
  },
  supplierName: { fontWeight: "500", color: colors.onSurface, fontSize: 14 },
  vendorLoc: { color: colors.muted, fontSize: 12 },
  followBtn: {
    borderWidth: 1,
    borderColor: colors.onSurface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  followText: { color: colors.onSurface, fontSize: 12, fontWeight: "500" },
  sectionLbl: { fontSize: 15, fontWeight: "500", color: colors.onSurface, marginBottom: 6 },
  desc: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  attrsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  attr: {
    flex: 1,
    minWidth: "45%",
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
  },
  attrLbl: { color: colors.muted, fontSize: 11, marginBottom: 4 },
  attrVal: { color: colors.onSurface, fontWeight: "500", fontSize: 13 },
  noReview: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 6 },
  reviewCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  reviewUser: { fontWeight: "500", color: colors.onSurface, fontSize: 13 },
  reviewTxt: { color: colors.onSurface, fontSize: 13, lineHeight: 19 },
  reviewDate: { color: colors.muted, fontSize: 11 },
  ctaBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingHorizontal: 16,
    paddingTop: 12,
    overflow: "hidden",
  },
  ctaInner: { flexDirection: "row", gap: 10 },
  addCart: {
    flex: 1,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addCartText: { color: colors.onBrandPrimary, fontWeight: "500", fontSize: 14 },
  buyNow: {
    backgroundColor: colors.brandSecondary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  buyNowText: { color: colors.onBrandSecondary, fontWeight: "500", fontSize: 14 },
});
