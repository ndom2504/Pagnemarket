import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
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
import { api } from "@/src/api";
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

function formatAt(at: any) {
  try {
    const d = typeof at === "string" ? new Date(at) : new Date(at);
    return d.toLocaleString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(at);
  }
}

export default function TailorCalendar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [title, setTitle] = useState("Essayage");
  const [at, setAt] = useState("");
  const [notes, setNotes] = useState("");

  const list = useQuery({ queryKey: ["tailor-appointments"], queryFn: () => api("/tailor/appointments") });
  const create = useMutation({
    mutationFn: () => {
      let iso = at.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(iso) && !iso.includes("T")) {
        iso = `${iso}T10:00:00`;
      }
      return api("/tailor/appointments", {
        method: "POST",
        body: JSON.stringify({
          clientName: clientName.trim(),
          title: title.trim(),
          at: iso,
          notes: notes.trim() || null,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tailor-appointments"] });
      qc.invalidateQueries({ queryKey: ["tailor-dashboard"] });
      setOpen(false);
      setClientName("");
      setTitle("Essayage");
      setAt("");
      setNotes("");
    },
    onError: (e: any) => Alert.alert("Erreur", e.message || "Date invalide"),
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/tailor/appointments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tailor-appointments"] });
      qc.invalidateQueries({ queryKey: ["tailor-dashboard"] });
    },
  });

  const data = (list.data as any[]) || [];

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F7" }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Calendrier</Text>
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
              <Icon name="calendar" size={40} color={colors.muted} />
              <Text style={styles.emptyTxt}>Planifiez essayages et rendez-vous clients.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onLongPress={() =>
                Alert.alert("Supprimer ce RDV ?", item.title, [
                  { text: "Annuler", style: "cancel" },
                  { text: "Supprimer", style: "destructive", onPress: () => del.mutate(item.id) },
                ])
              }
            >
              <View style={styles.dateBox}>
                <Icon name="calendar" size={18} color={colors.brandTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>{item.clientName}</Text>
                <Text style={styles.when}>{formatAt(item.at)}</Text>
                {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
              </View>
            </Pressable>
          )}
        />
      )}

      <Modal visible={open} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>Nouveau rendez-vous</Text>
            <TextInput style={styles.input} placeholder="Client" placeholderTextColor={colors.muted} value={clientName} onChangeText={setClientName} />
            <TextInput style={styles.input} placeholder="Titre" placeholderTextColor={colors.muted} value={title} onChangeText={setTitle} />
            <TextInput
              style={styles.input}
              placeholder="Date (AAAA-MM-JJ ou ISO)"
              placeholderTextColor={colors.muted}
              value={at}
              onChangeText={setAt}
            />
            <TextInput style={[styles.input, { minHeight: 64 }]} placeholder="Notes" placeholderTextColor={colors.muted} multiline value={notes} onChangeText={setNotes} />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancel} onPress={() => setOpen(false)}>
                <Text style={styles.cancelTxt}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.confirm, (!clientName.trim() || !at.trim() || title.trim().length < 2) && { opacity: 0.4 }]}
                disabled={!clientName.trim() || !at.trim() || title.trim().length < 2 || create.isPending}
                onPress={() => create.mutate()}
              >
                {create.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmTxt}>Planifier</Text>}
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
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F4F1EA",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  cardMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  when: { fontSize: 13, fontWeight: "600", color: colors.brandPrimary, marginTop: 6 },
  notes: { fontSize: 12, color: colors.onSurface, marginTop: 4 },
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
