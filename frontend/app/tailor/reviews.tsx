import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

export default function TailorReviews() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const q = useQuery({ queryKey: ["tailor-reviews"], queryFn: () => api("/tailor/reviews") });
  const data: any = q.data;
  const items = (data?.items as any[]) || [];

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F7" }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Avis clients</Text>
        <View style={{ width: 40 }} />
      </View>

      {q.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i, idx) => i.id || String(idx)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={styles.summary}>
              <Icon name="star" size={28} color={colors.brandTertiary} />
              <Text style={styles.rating}>{Number(data?.rating || 5).toFixed(1)}</Text>
              <Text style={styles.count}>{data?.count || 0} avis</Text>
              <Text style={styles.hint}>Votre réputation se construit avec chaque commande livrée.</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTxt}>Pas encore d’avis — soignez les essayages et les délais.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.author}>{item.authorName || item.userName || "Client"}</Text>
                <Text style={styles.stars}>{"★".repeat(Math.round(item.rating || 5))}</Text>
              </View>
              {item.comment || item.text ? <Text style={styles.comment}>{item.comment || item.text}</Text> : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "600", color: colors.onSurface },
  summary: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  rating: { fontSize: 36, fontWeight: "700", color: colors.onSurface },
  count: { fontSize: 13, color: colors.muted },
  hint: { fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 4 },
  empty: { padding: 24, alignItems: "center" },
  emptyTxt: { color: colors.muted, textAlign: "center", fontSize: 13 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  author: { fontWeight: "600", color: colors.onSurface },
  stars: { color: colors.brandTertiary, fontSize: 12 },
  comment: { fontSize: 13, color: colors.onSurface, lineHeight: 18 },
});
