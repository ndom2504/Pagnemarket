import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

const CATS = ["all", "Robes", "Ensembles", "Chemises", "Pantalons", "Boubous", "Mariage", "Cérémonie", "Enfants"];

export default function Models() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [cat, setCat] = useState<string>("all");
  const models = useQuery({
    queryKey: ["models", cat],
    queryFn: () => api(`/models?category=${cat}`),
  });

  const data = useMemo(() => models.data as any[] | undefined, [models.data]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Tailleurs</Text>
        <Text style={styles.subtitle}>
          Inspirez-vous, puis faites coudre le tissu que vous avez choisi.
        </Text>
        <FlatList
          horizontal
          data={CATS}
          keyExtractor={(k) => k}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingTop: 12 }}
          style={{ maxHeight: 56 }}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => {
            const active = cat === item;
            return (
              <Pressable
                testID={`model-chip-${item}`}
                onPress={() => setCat(item)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item === "all" ? "Tout" : item}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {models.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {(data || []).map((m) => (
            <Pressable
              key={m.id}
              testID={`model-item-${m.id}`}
              style={styles.card}
              onPress={() => router.push(`/creator/${m.creatorId}`)}
            >
              <Image source={{ uri: m.image }} style={styles.img} contentFit="cover" />
              <LinearGradient
                colors={["transparent", "rgba(17,17,17,0.85)"]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.overlay}>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{m.category}</Text>
                  </View>
                  <View style={[styles.tag, { backgroundColor: colors.brandSecondary }]}>
                    <Text style={[styles.tagText, { color: colors.onBrandSecondary }]}>
                      {m.difficulty}
                    </Text>
                  </View>
                </View>
                <Text style={styles.name}>{m.name}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.creator}>par {m.creatorName}</Text>
                  <Text style={styles.price}>À partir de {formatXAF(m.indicativePrice)}</Text>
                </View>
                <Pressable
                  testID={`want-model-${m.id}`}
                  style={styles.wantBtn}
                  onPress={() => router.push(`/creator/${m.creatorId}`)}
                >
                  <Text style={styles.wantText}>Je veux ce modèle</Text>
                  <Icon name="arrow-right" size={14} color={colors.onBrandPrimary} />
                </Pressable>
              </View>
            </Pressable>
          ))}
        </ScrollView>
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
  title: { fontSize: 28, fontWeight: "500", color: colors.onSurface, letterSpacing: -0.5 },
  subtitle: { color: colors.muted, marginTop: 4, fontSize: 13 },
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
  card: {
    height: 440,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surfaceInverse,
  },
  img: { width: "100%", height: "100%" },
  overlay: { position: "absolute", left: 16, right: 16, bottom: 16 },
  tag: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: { color: colors.onSurfaceInverse, fontSize: 11, fontWeight: "500" },
  name: {
    color: colors.onSurfaceInverse,
    fontSize: 22,
    fontWeight: "500",
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 14,
  },
  creator: { color: colors.onSurfaceInverse, opacity: 0.85, fontSize: 12 },
  price: { color: colors.brandTertiary, fontSize: 13, fontWeight: "500" },
  wantBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    borderRadius: 999,
  },
  wantText: { color: colors.onSurface, fontWeight: "500", fontSize: 13 },
});
