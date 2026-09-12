import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, formatXAF } from "@/src/api";
import { Icon } from "@/src/icon";
import { sewingStatusOf } from "@/src/sewing-status";
import { colors } from "@/src/theme";

export default function TailorRevenue() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const q = useQuery({ queryKey: ["tailor-revenue"], queryFn: () => api("/tailor/revenue") });
  const d: any = q.data;
  const recent = (d?.recent as any[]) || [];

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F7" }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Revenus</Text>
        <View style={{ width: 40 }} />
      </View>

      {q.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : (
        <FlatList
          data={recent}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={{ gap: 10, marginBottom: 6 }}>
              <View style={styles.hero}>
                <Text style={styles.heroLbl}>Revenus bruts (commandes terminées)</Text>
                <Text style={styles.heroVal}>{formatXAF(d?.gross || 0)}</Text>
                <Text style={styles.note}>{d?.note || "Versements manuels"}</Text>
              </View>
              <View style={styles.rowStats}>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{formatXAF(d?.pending || 0)}</Text>
                  <Text style={styles.statLbl}>En cours</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{d?.ordersPaid || 0}</Text>
                  <Text style={styles.statLbl}>Terminées</Text>
                </View>
              </View>
              <Text style={styles.section}>Récentes</Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>Aucune commande terminée pour l’instant.</Text>}
          renderItem={({ item }) => {
            const st = sewingStatusOf(item.status);
            return (
              <View style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMeta}>{item.clientName}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.price}>{formatXAF(item.price || 0)}</Text>
                  <Text style={[styles.status, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>
            );
          }}
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
  hero: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 18,
    padding: 20,
    gap: 6,
  },
  heroLbl: { color: "rgba(255,255,255,0.75)", fontSize: 12 },
  heroVal: { color: "#FFF", fontSize: 28, fontWeight: "700" },
  note: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 4 },
  rowStats: { flexDirection: "row", gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statVal: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  statLbl: { fontSize: 11, color: colors.muted, marginTop: 4 },
  section: { fontSize: 14, fontWeight: "700", color: colors.onSurface, marginTop: 4 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 20, fontSize: 13 },
  card: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardTitle: { fontWeight: "600", color: colors.onSurface },
  cardMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  price: { fontWeight: "700", color: colors.brandSecondary },
  status: { fontSize: 11, fontWeight: "600", marginTop: 4 },
});
