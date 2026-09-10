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

export default function ProductForm() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("wax");
  const [price, setPrice] = useState("");
  const [promoPrice, setPromoPrice] = useState("");
  const [stock, setStock] = useState("10");
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api("/categories") });
  const existing = useQuery({
    queryKey: ["product", id],
    queryFn: () => api(`/products/${id}`),
    enabled: editing,
  });

  useEffect(() => {
    const p: any = existing.data;
    if (!p) return;
    setName(p.name);
    setDescription(p.description);
    setCategory(p.category);
    setPrice(String(p.price));
    setPromoPrice(p.promoPrice ? String(p.promoPrice) : "");
    setStock(String(p.stock ?? 0));
    setImages(p.images || []);
  }, [existing.data]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim(),
        category,
        price: Number(price),
        promoPrice: promoPrice ? Number(promoPrice) : null,
        stock: Number(stock) || 0,
        images,
        tags: [category],
      };
      return editing
        ? api(`/supplier/products/${id}`, { method: "PUT", body: JSON.stringify(body) })
        : api("/supplier/products", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-products"] });
      qc.invalidateQueries({ queryKey: ["supplier-stats"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["trending"] });
      if (editing) qc.invalidateQueries({ queryKey: ["product", id] });
      router.back();
    },
    onError: (e: any) => setError(e.message || "Erreur lors de l'enregistrement"),
  });

  const valid = name.trim().length >= 2 && description.trim().length >= 5 && Number(price) > 0 && images.length > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="form-back" style={styles.iconBtn} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{editing ? "Modifier le tissu" : "Nouveau tissu"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Photos du tissu</Text>
          <PhotoPicker images={images} onChange={setImages} />
        </View>

        <Field label="Nom du tissu">
          <TextInput
            testID="input-name"
            style={styles.input}
            placeholder="Ex : Wax Royal Éclat"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
          />
        </Field>

        <Field label="Catégorie">
          <View style={styles.chips}>
            {((categories.data as any[]) || []).map((c) => (
              <Pressable
                key={c.slug}
                testID={`cat-${c.slug}`}
                style={[styles.chip, category === c.slug && styles.chipActive]}
                onPress={() => setCategory(c.slug)}
              >
                <Text style={[styles.chipTxt, category === c.slug && styles.chipTxtActive]}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <Field label="Prix (FCFA)" style={{ flex: 1 }}>
            <TextInput
              testID="input-price"
              style={styles.input}
              placeholder="12000"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              value={price}
              onChangeText={setPrice}
            />
          </Field>
          <Field label="Prix promo (optionnel)" style={{ flex: 1 }}>
            <TextInput
              testID="input-promo"
              style={styles.input}
              placeholder="—"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              value={promoPrice}
              onChangeText={setPromoPrice}
            />
          </Field>
        </View>

        <Field label="Stock (pièces)">
          <TextInput
            testID="input-stock"
            style={styles.input}
            keyboardType="numeric"
            value={stock}
            onChangeText={setStock}
          />
        </Field>

        <Field label="Description">
          <TextInput
            testID="input-description"
            style={[styles.input, { minHeight: 100, textAlignVertical: "top" }]}
            placeholder="Origine, matière, largeur, usage recommandé…"
            placeholderTextColor={colors.muted}
            multiline
            value={description}
            onChangeText={setDescription}
          />
        </Field>

        {error && <Text testID="form-error" style={styles.err}>{error}</Text>}

        <Pressable
          testID="save-product"
          style={[styles.saveBtn, !valid && { opacity: 0.5 }]}
          disabled={!valid || save.isPending}
          onPress={() => save.mutate()}
        >
          {save.isPending ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <Icon name="check" size={16} color={colors.onBrandPrimary} />
              <Text style={styles.saveTxt}>{editing ? "Enregistrer" : "Publier le tissu"}</Text>
            </>
          )}
        </Pressable>
        {!valid && (
          <Text style={styles.hint}>Ajoutez au moins une photo, un nom, un prix et une description.</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: any }) {
  return (
    <View style={[{ gap: 8 }, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
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
  label: { fontSize: 13, fontWeight: "500", color: colors.onSurface },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 14,
    color: colors.onSurface, backgroundColor: colors.surfaceTertiary,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
  },
  chipActive: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  chipTxt: { fontSize: 13, color: colors.onSurface, fontWeight: "500" },
  chipTxtActive: { color: colors.onSurfaceInverse },
  err: { color: colors.error, textAlign: "center", fontSize: 13 },
  saveBtn: {
    backgroundColor: colors.brandPrimary, paddingVertical: 16, borderRadius: 999,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  saveTxt: { color: colors.onBrandPrimary, fontWeight: "500", fontSize: 15 },
  hint: { color: colors.muted, fontSize: 12, textAlign: "center" },
});
