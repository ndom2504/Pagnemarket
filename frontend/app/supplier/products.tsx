import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, formatXAF } from "@/src/api";
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

export default function SupplierProducts() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<any | null>(null);

  const products = useQuery({ queryKey: ["supplier-products"], queryFn: () => api("/supplier/products") });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/supplier/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["supplier-products"] });
      qc.invalidateQueries({ queryKey: ["supplier-stats"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="products-back" style={styles.iconBtn} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Mes tissus</Text>
        <Pressable testID="products-add" style={[styles.iconBtn, { backgroundColor: colors.brandPrimary }]} onPress={() => router.push("/supplier/product-form")}>
          <Icon name="plus" size={20} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      {products.isLoading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.brandPrimary} />
      ) : (
        <FlatList
          data={(products.data as any[]) || []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          onRefresh={() => products.refetch()}
          refreshing={products.isRefetching}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="layers" size={28} color={colors.muted} />
              <Text style={styles.emptyTxt}>Aucun tissu en ligne. Ajoutez votre premier tissu avec vos photos.</Text>
              <Pressable testID="empty-add" style={styles.cta} onPress={() => router.push("/supplier/product-form")}>
                <Text style={styles.ctaTxt}>Ajouter un tissu</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row} testID={`supplier-product-${item.id}`}>
              <Image source={{ uri: item.images?.[0] }} style={styles.img} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.category} · Stock {item.stock}
                </Text>
                <Text style={styles.price}>
                  {formatXAF(item.promoPrice || item.price)}
                  {item.promoPrice ? <Text style={styles.old}>  {formatXAF(item.price)}</Text> : null}
                </Text>
              </View>
              <Pressable
                testID={`edit-${item.id}`}
                style={styles.actionBtn}
                onPress={() => router.push({ pathname: "/supplier/product-form", params: { id: item.id } })}
              >
                <Icon name="edit-2" size={16} color={colors.onSurface} />
              </Pressable>
              <Pressable testID={`delete-${item.id}`} style={styles.actionBtn} onPress={() => setToDelete(item)}>
                <Icon name="trash-2" size={16} color={colors.brandSecondary} />
              </Pressable>
            </View>
          )}
        />
      )}

      <Modal visible={!!toDelete} transparent animationType="fade" onRequestClose={() => setToDelete(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Supprimer ce tissu ?</Text>
            <Text style={styles.dialogTxt}>« {toDelete?.name} » ne sera plus visible par les acheteurs.</Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <Pressable style={[styles.dialogBtn, styles.dialogBtnGhost]} onPress={() => setToDelete(null)}>
                <Text style={styles.dialogBtnGhostTxt}>Annuler</Text>
              </Pressable>
              <Pressable
                testID="confirm-delete"
                style={[styles.dialogBtn, { backgroundColor: colors.brandSecondary }]}
                onPress={() => remove.mutate(toDelete.id)}
                disabled={remove.isPending}
              >
                {remove.isPending ? <ActivityIndicator color={colors.onBrandSecondary} /> : <Text style={styles.dialogBtnTxt}>Supprimer</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  img: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.surfaceSecondary },
  name: { fontSize: 14, fontWeight: "500", color: colors.onSurface },
  meta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  price: { fontSize: 13, fontWeight: "500", color: colors.onSurface, marginTop: 4 },
  old: { color: colors.muted, textDecorationLine: "line-through", fontWeight: "400", fontSize: 11 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 999, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  empty: { alignItems: "center", padding: 32, gap: 12, marginTop: 40 },
  emptyTxt: { color: colors.muted, textAlign: "center", fontSize: 13, lineHeight: 20 },
  cta: { backgroundColor: colors.brandPrimary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
  ctaTxt: { color: colors.onBrandPrimary, fontWeight: "500", fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: "rgba(17,17,17,0.5)", justifyContent: "center", padding: 24 },
  dialog: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, gap: 8 },
  dialogTitle: { fontSize: 18, fontWeight: "500", color: colors.onSurface },
  dialogTxt: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  dialogBtn: { flex: 1, paddingVertical: 13, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  dialogBtnGhost: { borderWidth: 1, borderColor: colors.border },
  dialogBtnGhostTxt: { color: colors.onSurface, fontWeight: "500" },
  dialogBtnTxt: { color: colors.onBrandSecondary, fontWeight: "500" },
});
