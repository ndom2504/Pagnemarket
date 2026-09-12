import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, formatXAF } from "@/src/api";
import { Icon } from "@/src/icon";
import { mediaUrl } from "@/src/media";
import { colors } from "@/src/theme";

export default function TailorCreations() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const models = useQuery({ queryKey: ["tailor-models"], queryFn: () => api("/tailor/models") });
  const del = useMutation({
    mutationFn: (id: string) => api(`/tailor/models/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tailor-models"] });
      qc.invalidateQueries({ queryKey: ["tailor-dashboard"] });
    },
  });

  const data = (models.data as any[]) || [];

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F7" }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Mes créations</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push("/tailor/creation-form")}>
          <Icon name="plus" size={18} color={colors.onBrandPrimary} />
        </Pressable>
      </View>
      {models.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="camera" size={40} color={colors.muted} />
              <Text style={styles.emptyTxt}>Publiez vos modèles, prix, tailles et délais.</Text>
              <Pressable style={styles.cta} onPress={() => router.push("/tailor/creation-form")}>
                <Text style={styles.ctaTxt}>Ajouter une création</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: "/tailor/creation-form", params: { id: item.id } } as any)}
              onLongPress={() =>
                Alert.alert("Supprimer ?", item.name, [
                  { text: "Annuler", style: "cancel" },
                  { text: "Supprimer", style: "destructive", onPress: () => del.mutate(item.id) },
                ])
              }
            >
              <Image source={{ uri: mediaUrl(item.image) }} style={styles.img} contentFit="cover" />
              <Text numberOfLines={1} style={styles.name}>
                {item.name}
              </Text>
              <Text style={styles.price}>{formatXAF(item.indicativePrice)}</Text>
              {item.leadDays ? <Text style={styles.meta}>{item.leadDays} j · délai</Text> : null}
            </Pressable>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: { fontSize: 22, fontWeight: "600", color: colors.onSurface },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", marginTop: 48, gap: 10, paddingHorizontal: 24 },
  emptyTxt: { color: colors.muted, textAlign: "center", fontSize: 13 },
  cta: {
    marginTop: 8,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  ctaTxt: { color: colors.onBrandPrimary, fontWeight: "600" },
  card: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    paddingBottom: 10,
  },
  img: { width: "100%", height: 160, backgroundColor: colors.surfaceSecondary },
  name: { marginTop: 8, marginHorizontal: 10, fontWeight: "600", color: colors.onSurface, fontSize: 13 },
  price: { marginHorizontal: 10, marginTop: 2, color: colors.brandSecondary, fontWeight: "600", fontSize: 12 },
  meta: { marginHorizontal: 10, marginTop: 2, color: colors.muted, fontSize: 11 },
});
