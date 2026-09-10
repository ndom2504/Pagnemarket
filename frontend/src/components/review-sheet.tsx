import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/src/api";
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

type Props = {
  item: { productId: string; name: string } | null;
  orderId: string;
  onClose: () => void;
};

const LABELS = ["", "Décevant", "Moyen", "Bien", "Très bien", "Excellent"];

export function ReviewSheet({ item, orderId, onClose }: Props) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      api("/reviews", {
        method: "POST",
        body: JSON.stringify({ productId: item!.productId, orderId, rating, comment }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["product", item!.productId] });
      qc.invalidateQueries({ queryKey: ["reviews", item!.productId] });
      reset();
      onClose();
    },
    onError: (e: any) => setError(e.message || "Impossible d'envoyer votre avis"),
  });

  const reset = () => {
    setRating(0);
    setComment("");
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={() => {}} testID="review-sheet">
          <Text style={styles.title}>Notez ce tissu</Text>
          <Text style={styles.sub} numberOfLines={1}>{item?.name}</Text>

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} testID={`star-${n}`} onPress={() => setRating(n)} style={styles.starBtn}>
                <Icon name="star" size={34} color={n <= rating ? colors.brandTertiary : colors.border} />
              </Pressable>
            ))}
          </View>
          <Text style={styles.ratingLbl}>{rating ? LABELS[rating] : "Touchez une étoile"}</Text>

          <TextInput
            testID="review-comment"
            style={styles.input}
            placeholder="Qualité du tissu, couleurs, livraison… (optionnel)"
            placeholderTextColor={colors.muted}
            multiline
            value={comment}
            onChangeText={setComment}
          />

          {error && <Text style={styles.err}>{error}</Text>}

          <Pressable
            testID="review-submit"
            style={[styles.btn, !rating && { opacity: 0.5 }]}
            disabled={!rating || submit.isPending}
            onPress={() => submit.mutate()}
          >
            {submit.isPending ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.btnTxt}>Publier mon avis</Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(17,17,17,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 10,
  },
  title: { fontSize: 20, fontWeight: "500", color: colors.onSurface, letterSpacing: -0.5 },
  sub: { color: colors.muted, fontSize: 13 },
  stars: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  starBtn: { padding: 4 },
  ratingLbl: { textAlign: "center", color: colors.brandSecondary, fontWeight: "500", fontSize: 13, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 14, minHeight: 90,
    textAlignVertical: "top", color: colors.onSurface, backgroundColor: colors.surfaceTertiary,
  },
  err: { color: colors.error, fontSize: 13, textAlign: "center" },
  btn: { marginTop: 6, backgroundColor: colors.brandPrimary, paddingVertical: 15, borderRadius: 999, alignItems: "center" },
  btnTxt: { color: colors.onBrandPrimary, fontWeight: "500", fontSize: 15 },
});
