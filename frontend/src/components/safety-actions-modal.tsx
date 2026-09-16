import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "@/src/api";
import { colors } from "@/src/theme";

export type ReportTargetType = "user" | "product" | "creator" | "message" | "review" | "other";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** User to block / report as user */
  userId?: string | null;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
  onBlocked?: () => void;
  onReported?: () => void;
};

const REASONS: { id: "spam" | "harassment" | "inappropriate" | "scam" | "ip" | "other"; label: string }[] = [
  { id: "spam", label: "Spam" },
  { id: "harassment", label: "Harcèlement" },
  { id: "inappropriate", label: "Contenu inapproprié" },
  { id: "scam", label: "Arnaque / fraude" },
  { id: "ip", label: "Contrefaçon / droits" },
  { id: "other", label: "Autre" },
];

export function SafetyActionsModal({
  visible,
  onClose,
  userId,
  targetType,
  targetId,
  targetLabel,
  onBlocked,
  onReported,
}: Props) {
  const [step, setStep] = useState<"menu" | "report">("menu");
  const [reason, setReason] = useState<(typeof REASONS)[number]["id"]>("inappropriate");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep("menu");
    setReason("inappropriate");
    setDetails("");
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const doBlock = () => {
    if (!userId) {
      Alert.alert("Indisponible", "Impossible de bloquer cette cible.");
      return;
    }
    Alert.alert(
      "Bloquer",
      `Bloquer ${targetLabel || "cet utilisateur"} ? Vous ne verrez plus ses messages.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Bloquer",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await api("/blocks", {
                method: "POST",
                body: JSON.stringify({ userId }),
              });
              Alert.alert("Bloqué", "L’utilisateur a été bloqué.");
              onBlocked?.();
              close();
            } catch (e: any) {
              Alert.alert("Erreur", e.message || "Impossible de bloquer");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const doReport = async () => {
    setBusy(true);
    try {
      await api("/reports", {
        method: "POST",
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          details: details.trim() || undefined,
        }),
      });
      Alert.alert("Signalement envoyé", "Notre équipe examinera ce contenu.");
      onReported?.();
      close();
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Impossible d’envoyer le signalement");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {step === "menu" ? (
            <>
              <Text style={styles.title}>Sécurité</Text>
              {targetLabel ? <Text style={styles.sub}>{targetLabel}</Text> : null}
              <Pressable
                testID="safety-report"
                style={styles.btn}
                onPress={() => setStep("report")}
                disabled={busy}
              >
                <Text style={styles.btnTxt}>Signaler</Text>
              </Pressable>
              {userId ? (
                <Pressable
                  testID="safety-block"
                  style={[styles.btn, styles.btnDanger]}
                  onPress={doBlock}
                  disabled={busy}
                >
                  <Text style={[styles.btnTxt, styles.btnDangerTxt]}>Bloquer</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.cancel} onPress={close}>
                <Text style={styles.cancelTxt}>Annuler</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>Signaler</Text>
              <Text style={styles.sub}>Pourquoi signalez-vous ce contenu ?</Text>
              <View style={styles.reasons}>
                {REASONS.map((r) => (
                  <Pressable
                    key={r.id}
                    style={[styles.chip, reason === r.id && styles.chipOn]}
                    onPress={() => setReason(r.id)}
                  >
                    <Text style={[styles.chipTxt, reason === r.id && styles.chipTxtOn]}>{r.label}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Détails (optionnel)"
                placeholderTextColor={colors.muted}
                value={details}
                onChangeText={setDetails}
                multiline
              />
              <Pressable
                testID="safety-report-submit"
                style={[styles.btn, styles.btnPrimary]}
                onPress={doReport}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={[styles.btnTxt, { color: colors.onBrandPrimary }]}>Envoyer</Text>
                )}
              </Pressable>
              <Pressable style={styles.cancel} onPress={() => setStep("menu")}>
                <Text style={styles.cancelTxt}>Retour</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: "600", color: colors.onSurface },
  sub: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  btn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
  },
  btnPrimary: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  btnDanger: { borderColor: "#E8C4C0", backgroundColor: "#FFF5F4" },
  btnTxt: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  btnDangerTxt: { color: colors.error },
  cancel: { paddingVertical: 12, alignItems: "center" },
  cancelTxt: { color: colors.muted, fontSize: 14 },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
  },
  chipOn: { backgroundColor: colors.brandSecondary, borderColor: colors.brandSecondary },
  chipTxt: { fontSize: 12, color: colors.onSurface },
  chipTxtOn: { color: colors.onBrandSecondary, fontWeight: "600" },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.onSurface,
    backgroundColor: colors.surfaceTertiary,
    textAlignVertical: "top",
  },
});
