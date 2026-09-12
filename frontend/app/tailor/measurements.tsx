import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

const FIELDS = [
  { key: "tour", label: "Tour de poitrine" },
  { key: "waist", label: "Tour de taille" },
  { key: "hips", label: "Tour de hanches" },
  { key: "shoulder", label: "Épaules" },
  { key: "sleeve", label: "Longueur manche" },
  { key: "length", label: "Longueur" },
  { key: "neck", label: "Cou" },
];

export default function TailorMeasurements() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [label, setLabel] = useState("Mensurations");
  const [notes, setNotes] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const list = useQuery({ queryKey: ["tailor-measurements"], queryFn: () => api("/tailor/measurements") });
  const create = useMutation({
    mutationFn: () => {
      const parsed: Record<string, number> = {};
      for (const [k, v] of Object.entries(values)) {
        const n = Number(String(v).replace(",", "."));
        if (!Number.isNaN(n) && String(v).trim()) parsed[k] = n;
      }
      return api("/tailor/measurements", {
        method: "POST",
        body: JSON.stringify({
          clientName: clientName.trim(),
          label: label.trim() || "Mensurations",
          values: parsed,
          notes: notes.trim() || null,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tailor-measurements"] });
      qc.invalidateQueries({ queryKey: ["tailor-dashboard"] });
      setOpen(false);
      setClientName("");
      setLabel("Mensurations");
      setNotes("");
      setValues({});
    },
    onError: (e: any) => Alert.alert("Erreur", e.message || "Impossible d’enregistrer"),
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/tailor/measurements/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tailor-measurements"] }),
  });

  const data = (list.data as any[]) || [];

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F7" }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Mesures</Text>
        <Pressable style={styles.addBtn} onPress={() => setOpen(true)}>
          <Icon name="plus" size={18} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      {list.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="edit-3" size={40} color={colors.muted} />
              <Text style={styles.emptyTxt}>Enregistrez les mensurations de vos clients pour la confection.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const vals = item.values || {};
            const keys = Object.keys(vals);
            return (
              <Pressable
                style={styles.card}
                onLongPress={() =>
                  Alert.alert("Supprimer cette fiche ?", item.clientName, [
                    { text: "Annuler", style: "cancel" },
                    { text: "Supprimer", style: "destructive", onPress: () => del.mutate(item.id) },
                  ])
                }
              >
                <Text style={styles.cardTitle}>{item.clientName}</Text>
                <Text style={styles.cardMeta}>{item.label}</Text>
                <View style={styles.grid}>
                  {keys.length === 0 ? (
                    <Text style={styles.cardMeta}>Aucune valeur</Text>
                  ) : (
                    keys.map((k) => (
                      <View key={k} style={styles.pill}>
                        <Text style={styles.pillTxt}>
                          {FIELDS.find((f) => f.key === k)?.label || k}: {vals[k]} cm
                        </Text>
                      </View>
                    ))
                  )}
                </View>
                {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={open} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + 16, maxHeight: "90%" }]}>
            <Text style={styles.modalTitle}>Nouvelle fiche mesures</Text>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
              <TextInput style={styles.input} placeholder="Nom du client" placeholderTextColor={colors.muted} value={clientName} onChangeText={setClientName} />
              <TextInput style={styles.input} placeholder="Libellé" placeholderTextColor={colors.muted} value={label} onChangeText={setLabel} />
              {FIELDS.map((f) => (
                <TextInput
                  key={f.key}
                  style={styles.input}
                  placeholder={`${f.label} (cm)`}
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={values[f.key] || ""}
                  onChangeText={(t) => setValues((prev) => ({ ...prev, [f.key]: t }))}
                />
              ))}
              <TextInput
                style={[styles.input, { minHeight: 64 }]}
                placeholder="Notes"
                placeholderTextColor={colors.muted}
                multiline
                value={notes}
                onChangeText={setNotes}
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancel} onPress={() => setOpen(false)}>
                <Text style={styles.cancelTxt}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.confirm, !clientName.trim() && { opacity: 0.4 }]}
                disabled={!clientName.trim() || create.isPending}
                onPress={() => create.mutate()}
              >
                {create.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmTxt}>Enregistrer</Text>}
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
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "600", color: colors.onSurface },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", marginTop: 48, gap: 10, paddingHorizontal: 28 },
  emptyTxt: { color: colors.muted, textAlign: "center", fontSize: 13 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  cardMeta: { fontSize: 12, color: colors.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: {
    backgroundColor: "#F4F1EA",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillTxt: { fontSize: 11, fontWeight: "600", color: colors.brandPrimary },
  notes: { fontSize: 12, color: colors.onSurface, marginTop: 4 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.onSurface,
  },
  modalActions: { flexDirection: "row", gap: 10 },
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
