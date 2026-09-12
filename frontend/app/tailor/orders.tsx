import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, formatXAF } from "@/src/api";
import { Icon } from "@/src/icon";
import { SEWING_FLOW, sewingStatusOf } from "@/src/sewing-status";
import { colors } from "@/src/theme";

export default function TailorOrders() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");

  const orders = useQuery({ queryKey: ["tailor-orders"], queryFn: () => api("/tailor/orders") });
  const create = useMutation({
    mutationFn: () =>
      api("/tailor/orders", {
        method: "POST",
        body: JSON.stringify({
          clientName: clientName.trim(),
          title: title.trim(),
          price: Number(price) || 0,
          dueDate: dueDate.trim() || null,
          notes: notes.trim() || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tailor-orders"] });
      qc.invalidateQueries({ queryKey: ["tailor-dashboard"] });
      setOpen(false);
      setClientName("");
      setTitle("");
      setPrice("");
      setDueDate("");
      setNotes("");
    },
    onError: (e: any) => Alert.alert("Erreur", e.message || "Impossible de créer"),
  });

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/tailor/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tailor-orders"] });
      qc.invalidateQueries({ queryKey: ["tailor-dashboard"] });
    },
  });

  const raw = ((orders.data as any[]) || []) as any[];
  const data = raw.filter((o) => {
    if (filter === "active") return !["done", "delivered", "cancelled"].includes(o.status);
    if (filter === "done") return ["done", "delivered"].includes(o.status);
    return true;
  });

  const nextStatus = (status: string) => {
    const i = SEWING_FLOW.indexOf(status as any);
    if (i < 0 || i >= SEWING_FLOW.length - 1) return null;
    return SEWING_FLOW[i + 1];
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F7" }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Commandes</Text>
        <Pressable style={styles.addBtn} onPress={() => setOpen(true)}>
          <Icon name="plus" size={18} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <View style={styles.filters}>
        {(
          [
            ["all", "Toutes"],
            ["active", "En cours"],
            ["done", "Terminées"],
          ] as const
        ).map(([k, label]) => (
          <Pressable key={k} style={[styles.filter, filter === k && styles.filterOn]} onPress={() => setFilter(k)}>
            <Text style={[styles.filterTxt, filter === k && styles.filterTxtOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {orders.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="clipboard" size={40} color={colors.muted} />
              <Text style={styles.emptyTxt}>Créez une commande personnalisée ou recevez-en via la messagerie.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const st = sewingStatusOf(item.status);
            const next = nextStatus(item.status);
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardMeta}>{item.clientName}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: st.color + "22" }]}>
                    <Text style={[styles.badgeTxt, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                <View style={styles.flow}>
                  {SEWING_FLOW.map((s, idx) => {
                    const cur = SEWING_FLOW.indexOf(item.status);
                    const done = cur >= idx;
                    return <View key={s} style={[styles.dot, done && { backgroundColor: colors.brandPrimary }]} />;
                  })}
                </View>
                <View style={styles.cardBottom}>
                  <Text style={styles.price}>{formatXAF(item.price || 0)}</Text>
                  {item.dueDate ? <Text style={styles.due}>Livraison {String(item.dueDate).slice(0, 10)}</Text> : null}
                </View>
                {next ? (
                  <Pressable
                    style={styles.nextBtn}
                    onPress={() =>
                      Alert.alert("Avancer l’étape ?", sewingStatusOf(next).label, [
                        { text: "Annuler", style: "cancel" },
                        { text: "Confirmer", onPress: () => advance.mutate({ id: item.id, status: next }) },
                      ])
                    }
                  >
                    <Text style={styles.nextTxt}>→ {sewingStatusOf(next).label}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
      )}

      <Modal visible={open} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>Nouvelle commande</Text>
            <TextInput style={styles.input} placeholder="Client" placeholderTextColor={colors.muted} value={clientName} onChangeText={setClientName} />
            <TextInput style={styles.input} placeholder="Titre (ex. Costume mariage)" placeholderTextColor={colors.muted} value={title} onChangeText={setTitle} />
            <TextInput style={styles.input} placeholder="Prix (XAF)" placeholderTextColor={colors.muted} keyboardType="numeric" value={price} onChangeText={setPrice} />
            <TextInput style={styles.input} placeholder="Date livraison (AAAA-MM-JJ)" placeholderTextColor={colors.muted} value={dueDate} onChangeText={setDueDate} />
            <TextInput style={[styles.input, { minHeight: 72 }]} placeholder="Notes" placeholderTextColor={colors.muted} multiline value={notes} onChangeText={setNotes} />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancel} onPress={() => setOpen(false)}>
                <Text style={styles.cancelTxt}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.confirm, (!clientName.trim() || title.trim().length < 2) && { opacity: 0.4 }]}
                disabled={!clientName.trim() || title.trim().length < 2 || create.isPending}
                onPress={() => create.mutate()}
              >
                {create.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmTxt}>Créer</Text>}
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
  filters: { flexDirection: "row", gap: 8, padding: 16, paddingBottom: 0 },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  filterTxt: { fontSize: 12, fontWeight: "600", color: colors.onSurface },
  filterTxtOn: { color: colors.onBrandPrimary },
  empty: { alignItems: "center", marginTop: 48, gap: 10, paddingHorizontal: 28 },
  emptyTxt: { color: colors.muted, textAlign: "center", fontSize: 13 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  cardMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 11, fontWeight: "700" },
  flow: { flexDirection: "row", gap: 6 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.divider },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  price: { fontWeight: "700", color: colors.brandSecondary, fontSize: 14 },
  due: { fontSize: 11, color: colors.muted },
  nextBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#F4F1EA",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  nextTxt: { fontSize: 12, fontWeight: "600", color: colors.brandPrimary },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.onSurface, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.onSurface,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  cancelTxt: { fontWeight: "600", color: colors.onSurface },
  confirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: colors.brandPrimary,
  },
  confirmTxt: { fontWeight: "700", color: colors.onBrandPrimary },
});
