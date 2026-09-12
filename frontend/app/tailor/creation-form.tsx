import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { PhotoPicker } from "@/src/components/photo-picker";
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

const SIZE_OPTS = ["XS", "S", "M", "L", "XL", "XXL", "Sur-mesure"];
const CATEGORIES = ["sur-mesure", "robe", "costume", "boubou", "accessoire", "enfant"];
const DIFFS = ["Débutant", "Intermédiaire", "Avancé", "Haute couture"];

export default function CreationForm() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("sur-mesure");
  const [price, setPrice] = useState("");
  const [leadDays, setLeadDays] = useState("7");
  const [difficulty, setDifficulty] = useState("Intermédiaire");
  const [fabric, setFabric] = useState("");
  const [sizes, setSizes] = useState<string[]>(["Sur-mesure"]);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ["tailor-model", id],
    queryFn: async () => {
      const list = (await api("/tailor/models")) as any[];
      return list.find((m) => m.id === id) || null;
    },
    enabled: editing,
  });

  useEffect(() => {
    const m: any = existing.data;
    if (!m) return;
    setName(m.name || "");
    setDescription(m.description || "");
    setCategory(m.category || "sur-mesure");
    setPrice(String(m.indicativePrice ?? ""));
    setLeadDays(String(m.leadDays ?? 7));
    setDifficulty(m.difficulty || "Intermédiaire");
    setFabric(m.fabricRecommendation || "");
    setSizes(m.sizes?.length ? m.sizes : ["Sur-mesure"]);
    setImages(m.images?.length ? m.images : m.image ? [m.image] : []);
  }, [existing.data]);

  const toggleSize = (s: string) => {
    setSizes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim(),
        category,
        indicativePrice: Number(price),
        difficulty,
        image: images[0],
        images,
        sizes,
        leadDays: Number(leadDays) || 7,
        fabricRecommendation: fabric.trim() || null,
      };
      return editing
        ? api(`/tailor/models/${id}`, { method: "PUT", body: JSON.stringify(body) })
        : api("/tailor/models", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tailor-models"] });
      qc.invalidateQueries({ queryKey: ["tailor-dashboard"] });
      router.back();
    },
    onError: (e: any) => setError(e.message || "Erreur lors de l'enregistrement"),
  });

  const valid =
    name.trim().length >= 2 &&
    description.trim().length >= 5 &&
    Number(price) > 0 &&
    images.length > 0 &&
    sizes.length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F4F5F7" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{editing ? "Modifier la création" : "Nouvelle création"}</Text>
        <View style={{ width: 40 }} />
      </View>

      {editing && existing.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Photos du modèle</Text>
            <PhotoPicker images={images} onChange={setImages} />
          </View>

          <Field label="Nom">
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Robe wax sur-mesure" placeholderTextColor={colors.muted} />
          </Field>

          <Field label="Description">
            <TextInput
              style={[styles.input, { minHeight: 100, textAlignVertical: "top" }]}
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Coupe, occasions, tissus recommandés…"
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Field label="Catégorie">
            <View style={styles.chips}>
              {CATEGORIES.map((c) => (
                <Pressable key={c} style={[styles.chip, category === c && styles.chipOn]} onPress={() => setCategory(c)}>
                  <Text style={[styles.chipTxt, category === c && styles.chipTxtOn]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label="Prix indicatif (XAF)">
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="45000"
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Field label="Délai (jours)">
            <TextInput
              style={styles.input}
              value={leadDays}
              onChangeText={setLeadDays}
              keyboardType="numeric"
              placeholder="7"
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Field label="Tailles disponibles">
            <View style={styles.chips}>
              {SIZE_OPTS.map((s) => (
                <Pressable key={s} style={[styles.chip, sizes.includes(s) && styles.chipOn]} onPress={() => toggleSize(s)}>
                  <Text style={[styles.chipTxt, sizes.includes(s) && styles.chipTxtOn]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label="Difficulté">
            <View style={styles.chips}>
              {DIFFS.map((d) => (
                <Pressable key={d} style={[styles.chip, difficulty === d && styles.chipOn]} onPress={() => setDifficulty(d)}>
                  <Text style={[styles.chipTxt, difficulty === d && styles.chipTxtOn]}>{d}</Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label="Tissu recommandé (optionnel)">
            <TextInput
              style={styles.input}
              value={fabric}
              onChangeText={setFabric}
              placeholder="Wax premium, brodé…"
              placeholderTextColor={colors.muted}
            />
          </Field>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.save, !valid && { opacity: 0.45 }]}
            disabled={!valid || save.isPending}
            onPress={() => save.mutate()}
          >
            {save.isPending ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.saveTxt}>{editing ? "Enregistrer" : "Publier la création"}</Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
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
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "600", color: colors.onSurface },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.onSurface,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipTxt: { fontSize: 12, color: colors.onSurface, fontWeight: "500" },
  chipTxtOn: { color: colors.onBrandPrimary },
  error: { color: colors.error, fontSize: 13 },
  save: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveTxt: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 15 },
});
