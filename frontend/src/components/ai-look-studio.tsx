import { useMutation } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { Icon } from "@/src/icon";
import { mediaUrl } from "@/src/media";
import { colors } from "@/src/theme";

const GARMENTS = ["Robe", "Boubou", "Ensemble", "Chemise", "Pantalon", "Mariage"] as const;

const RITUAL = [
  "On lit le motif…",
  "On coupe la silhouette…",
  "On pose la lumière…",
  "Le tissu prend vie.",
];

type Look = {
  id: string;
  image: string;
  title: string;
  story: string;
  garment: string;
  productName: string;
};

type Props = {
  productId: string;
  productName: string;
  onOpenTailors: (garment: string) => void;
  onAddToCart: () => void;
};

export function AiLookStudio({ productId, productName, onOpenTailors, onAddToCart }: Props) {
  const insets = useSafeAreaInsets();
  const [garment, setGarment] = useState<(typeof GARMENTS)[number]>("Robe");
  const [look, setLook] = useState<Look | null>(null);
  const [open, setOpen] = useState(false);
  const [imgReady, setImgReady] = useState(false);
  const [ritual, setRitual] = useState(0);
  const ignore = useRef(false);

  const generate = useMutation({
    mutationFn: () =>
      api<Look>("/ai/looks", {
        method: "POST",
        body: JSON.stringify({ productId, garment }),
      }),
    onMutate: () => {
      ignore.current = false;
      setImgReady(false);
      setLook(null);
      setOpen(true);
    },
    onSuccess: (data) => {
      if (ignore.current) return;
      setLook(data);
    },
    onError: () => {
      if (ignore.current) return;
      setOpen(false);
    },
  });

  const pending = generate.isPending;
  const revealing = open && (pending || (!!look && !imgReady));

  const close = () => {
    ignore.current = true;
    setOpen(false);
    generate.reset();
  };

  const reject = () => {
    ignore.current = true;
    setLook(null);
    setImgReady(false);
    setOpen(false);
    generate.reset();
  };

  useEffect(() => {
    if (!revealing) {
      setRitual(0);
      return;
    }
    const t = setInterval(() => setRitual((i) => (i + 1) % RITUAL.length), 1800);
    return () => clearInterval(t);
  }, [revealing]);

  useEffect(() => {
    if (!look || imgReady) return;
    const t = setTimeout(() => setImgReady(true), 12000);
    return () => clearTimeout(t);
  }, [look, imgReady]);

  return (
    <View style={styles.card} testID="ai-look-studio">
      <View style={styles.cardHead}>
        <View style={styles.spark}>
          <Icon name="zap" size={16} color={colors.brandTertiary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Imaginez-le porté</Text>
          <Text style={styles.lead}>
            Choisissez une silhouette. L’IA compose un modèle avec ce tissu.
          </Text>
        </View>
      </View>

      <View style={styles.chips}>
        {GARMENTS.map((g) => {
          const active = garment === g;
          return (
            <Pressable
              key={g}
              testID={`garment-${g}`}
              onPress={() => setGarment(g)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{g}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        testID="generate-look"
        style={styles.cta}
        onPress={() => generate.mutate()}
        disabled={pending}
      >
        {pending ? (
          <ActivityIndicator color={colors.onBrandPrimary} />
        ) : (
          <>
            <Icon name="aperture" size={16} color={colors.onBrandPrimary} />
            <Text style={styles.ctaTxt}>Générer un modèle avec l’IA</Text>
          </>
        )}
      </Pressable>

      {generate.isError && (
        <Text style={styles.err}>
          {(generate.error as Error)?.message || "Impossible de générer le modèle pour le moment."}
        </Text>
      )}

      {look && imgReady && !open && (
        <Pressable testID="look-preview" style={styles.preview} onPress={() => setOpen(true)}>
          <Image source={{ uri: mediaUrl(look.image) }} style={styles.previewImg} contentFit="cover" />
          <LinearGradient colors={["transparent", "rgba(17,17,17,0.85)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.previewCap}>
            <Text style={styles.previewTitle}>{look.title}</Text>
            <Text style={styles.previewStory} numberOfLines={2}>
              {look.story}
            </Text>
          </View>
        </Pressable>
      )}

      <Pressable testID="open-tailors" style={styles.ghost} onPress={() => onOpenTailors(garment)}>
        <Icon name="scissors" size={14} color={colors.onSurface} />
        <Text style={styles.ghostTxt}>Faire coudre par un tailleur</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={pending ? close : reject}>
        <View style={styles.resultWrap}>
          {look ? (
            <Image
              source={{ uri: mediaUrl(look.image) }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              onLoad={() => {
                setImgReady(true);
                if (Platform.OS !== "web") {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              }}
              onError={() => setImgReady(true)}
            />
          ) : null}
          {revealing ? (
            <View style={[styles.ritual, look ? styles.ritualOver : null]} testID="look-ritual">
              <ActivityIndicator color={colors.brandTertiary} size="large" />
              <Text style={styles.ritualTitle}>Atelier IA · FASHN</Text>
              <Text style={styles.ritualLine}>{RITUAL[ritual]}</Text>
              <Text style={styles.ritualSub}>{productName} · {garment}</Text>
              <Text style={styles.ritualHint}>Environ 10 à 25 secondes</Text>
              <Pressable testID="look-cancel" onPress={close} style={styles.cancelBtn}>
                <Text style={styles.cancelTxt}>Annuler</Text>
              </Pressable>
            </View>
          ) : look ? (
            <>
              <LinearGradient
                colors={["rgba(17,17,17,0.15)", "rgba(17,17,17,0.88)"]}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.resultInner, { paddingBottom: Math.max(insets.bottom, 28) }]} testID="look-result">
                <Text style={styles.resultKicker}>Votre modèle</Text>
                <Text style={styles.resultTitle}>{look.title}</Text>
                <Text style={styles.resultStory}>{look.story}</Text>
                <View style={styles.resultActions}>
                  <Pressable
                    testID="look-add-cart"
                    style={styles.resultPrimary}
                    onPress={() => {
                      setOpen(false);
                      onAddToCart();
                    }}
                  >
                    <Text style={styles.resultPrimaryTxt}>Ajouter ce tissu</Text>
                  </Pressable>
                  <Pressable
                    testID="look-tailor"
                    style={styles.resultGhost}
                    onPress={() => {
                      const g = look.garment;
                      setOpen(false);
                      onOpenTailors(g);
                    }}
                  >
                    <Text style={styles.resultGhostTxt}>Le faire coudre</Text>
                  </Pressable>
                </View>
                <View style={styles.rejectRow}>
                  <Pressable testID="look-reject" onPress={reject} style={styles.rejectBtn}>
                    <Text style={styles.rejectTxt}>Rejeter ce modèle</Text>
                  </Pressable>
                  <Pressable testID="look-retry" onPress={() => generate.mutate()} style={styles.rejectBtn}>
                    <Text style={styles.retryTxt}>Générer un autre</Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  cardHead: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  spark: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.surfaceInverse,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: { fontSize: 16, fontWeight: "500", color: colors.onSurface, letterSpacing: -0.3 },
  lead: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  chipTxt: { fontSize: 12, fontWeight: "500", color: colors.onSurface },
  chipTxtActive: { color: colors.onSurfaceInverse },
  cta: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 13,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaTxt: { color: colors.onBrandPrimary, fontWeight: "500", fontSize: 14 },
  err: { color: colors.error, fontSize: 12, textAlign: "center" },
  preview: {
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surfaceInverse,
  },
  previewImg: { width: "100%", height: "100%" },
  previewCap: { position: "absolute", left: 12, right: 12, bottom: 12 },
  previewTitle: { color: colors.onSurfaceInverse, fontWeight: "500", fontSize: 14 },
  previewStory: { color: colors.onSurfaceInverse, opacity: 0.85, fontSize: 12, marginTop: 4 },
  ghost: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
  },
  ghostTxt: { color: colors.onSurface, fontWeight: "500", fontSize: 13 },
  ritual: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  ritualOver: { backgroundColor: "rgba(17,17,17,0.92)" },
  ritualTitle: { color: colors.brandTertiary, fontSize: 13, letterSpacing: 2, fontWeight: "500" },
  ritualLine: { color: colors.onSurfaceInverse, fontSize: 22, fontWeight: "500", textAlign: "center" },
  ritualSub: { color: colors.onSurfaceInverse, opacity: 0.6, fontSize: 13 },
  ritualHint: { color: colors.onSurfaceInverse, opacity: 0.45, fontSize: 12, marginTop: 4 },
  cancelBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24 },
  cancelTxt: { color: colors.onSurfaceInverse, opacity: 0.8, fontSize: 14, fontWeight: "500" },
  resultWrap: { flex: 1, backgroundColor: "#111111", justifyContent: "flex-end" },
  resultInner: { padding: 24, gap: 10 },
  resultKicker: { color: colors.brandTertiary, fontSize: 12, letterSpacing: 1.4, fontWeight: "500" },
  resultTitle: { color: colors.onSurfaceInverse, fontSize: 24, fontWeight: "500", letterSpacing: -0.5 },
  resultStory: { color: colors.onSurfaceInverse, opacity: 0.88, fontSize: 14, lineHeight: 22 },
  resultActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  resultPrimary: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  resultPrimaryTxt: { color: colors.onSurface, fontWeight: "500", fontSize: 14 },
  resultGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(250,248,243,0.4)",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  resultGhostTxt: { color: colors.onSurfaceInverse, fontWeight: "500", fontSize: 14 },
  rejectRow: { flexDirection: "row", justifyContent: "center", gap: 16, paddingTop: 6 },
  rejectBtn: { paddingVertical: 8, paddingHorizontal: 8 },
  rejectTxt: { color: colors.onSurfaceInverse, opacity: 0.7, fontSize: 13 },
  retryTxt: { color: colors.brandTertiary, fontSize: 13, fontWeight: "500" },
});
