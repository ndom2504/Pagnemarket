import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
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
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

type Operator = "orange" | "mtn" | "moov";

// Operator brand colors (identical in light/dark — third-party brands)
const OPERATORS: { id: Operator; name: string; short: string; color: string; onColor: string; ussd: string }[] = [
  { id: "orange", name: "Orange Money", short: "OM", color: "#FF7900", onColor: "#FFFFFF", ussd: "#150#" },
  { id: "mtn", name: "MTN Mobile Money", short: "MoMo", color: "#FFCC00", onColor: "#111111", ussd: "*126#" },
  { id: "moov", name: "Moov Money", short: "Moov", color: "#0066B3", onColor: "#FFFFFF", ussd: "*155#" },
];

export default function Checkout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Libreville");
  const [country, setCountry] = useState("Gabon");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"card" | "mobile">("mobile");
  const [operator, setOperator] = useState<Operator>("orange");
  const [momoPhone, setMomoPhone] = useState("");
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState<any | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const config = useQuery({ queryKey: ["payments-config"], queryFn: () => api("/payments/config", { auth: false }) });
  const isLive = (config.data as any)?.mobileMoneyMode === "live";

  const finish = () => {
    qc.invalidateQueries({ queryKey: ["cart"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    setPending(null);
    setOk(true);
  };

  const place = useMutation({
    mutationFn: () =>
      api("/orders", {
        method: "POST",
        body: JSON.stringify({ address, city, country, phone, paymentMethod: "card" }),
      }),
    onSuccess: finish,
  });

  const momo = useMutation({
    mutationFn: () =>
      api("/payments/mobile-money/init", {
        method: "POST",
        body: JSON.stringify({ address, city, country, phone, operator, momoPhone: momoPhone || phone }),
      }),
    onSuccess: async (r: any) => {
      setPayError(null);
      setPending(r);
      if (r.paymentUrl) {
        try {
          await WebBrowser.openBrowserAsync(r.paymentUrl);
        } catch {
          /* user closed the browser — polling continues */
        }
      }
    },
  });

  // Poll payment status while pending
  useEffect(() => {
    if (!pending) return;
    let ticks = 0;
    pollRef.current = setInterval(async () => {
      ticks += 1;
      try {
        const s: any = await api(`/payments/${pending.transactionId}/status`);
        if (s.status === "PAID") {
          clearInterval(pollRef.current!);
          finish();
        } else if (s.status === "FAILED") {
          clearInterval(pollRef.current!);
          setPending(null);
          setPayError("Paiement refusé par l'opérateur. Vérifiez votre solde et réessayez.");
        } else if (ticks > 100) {
          clearInterval(pollRef.current!);
          setPending(null);
          setPayError("Délai dépassé. Si vous avez validé le paiement, il apparaîtra dans vos commandes.");
        }
      } catch {
        /* transient network error, keep polling */
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.transactionId]);

  const op = OPERATORS.find((o) => o.id === operator)!;
  const canPay = !!address && !!phone && (method === "card" || (momoPhone || phone).length >= 8);
  const busy = place.isPending || momo.isPending;

  if (ok) {
    return (
      <View style={styles.doneWrap}>
        <View style={styles.doneBadge}>
          <Icon name="check" size={36} color={colors.onSuccess} />
        </View>
        <Text style={styles.doneTitle}>Merci pour votre commande !</Text>
        <Text style={styles.doneSub}>
          Votre paiement a été confirmé. Le fournisseur prépare votre commande, vous serez informé dès l'expédition.
        </Text>
        <Pressable
          testID="done-back"
          style={styles.doneCta}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={styles.doneCtaText}>Retour à l'accueil</Text>
        </Pressable>
      </View>
    );
  }

  if (pending) {
    return (
      <View style={styles.doneWrap} testID="momo-pending">
        <View style={[styles.opBadgeBig, { backgroundColor: op.color }]}>
          <Text style={[styles.opBadgeBigTxt, { color: op.onColor }]}>{op.short}</Text>
        </View>
        <Text style={styles.doneTitle}>Confirmez sur votre téléphone</Text>
        <Text style={styles.doneSub}>
          Une demande de paiement {op.name} de {Math.round(pending.amount).toLocaleString("fr-FR")} {pending.currency} a été envoyée
          au {momoPhone || phone}. Validez avec votre code secret.
        </Text>
        <View style={styles.stepsCard}>
          <Step n="1" txt={`Ouvrez la notification ${op.name} ou composez ${op.ussd}`} />
          <Step n="2" txt="Vérifiez le montant et le marchand PagneMarket" />
          <Step n="3" txt="Saisissez votre code secret pour valider" />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
          <ActivityIndicator color={colors.brandSecondary} />
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            {pending.mode === "simulation" ? "Mode démo : confirmation automatique…" : "En attente de confirmation…"}
          </Text>
        </View>
        {pending.paymentUrl && (
          <Pressable style={styles.linkBtn} onPress={() => WebBrowser.openBrowserAsync(pending.paymentUrl)}>
            <Text style={styles.linkTxt}>Rouvrir la page de paiement</Text>
          </Pressable>
        )}
        <Pressable testID="momo-cancel" style={styles.ghostBtn} onPress={() => setPending(null)}>
          <Text style={styles.ghostTxt}>Annuler</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="checkout-back" style={styles.iconBtn} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Paiement</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <Text style={styles.section}>Adresse de livraison</Text>
        <TextInput
          testID="input-address"
          style={styles.input}
          placeholder="Rue et quartier"
          placeholderTextColor={colors.muted}
          value={address}
          onChangeText={setAddress}
        />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TextInput
            testID="input-city"
            style={[styles.input, { flex: 1 }]}
            placeholder="Ville"
            placeholderTextColor={colors.muted}
            value={city}
            onChangeText={setCity}
          />
          <TextInput
            testID="input-country"
            style={[styles.input, { flex: 1 }]}
            placeholder="Pays"
            placeholderTextColor={colors.muted}
            value={country}
            onChangeText={setCountry}
          />
        </View>
        <TextInput
          testID="input-phone"
          style={styles.input}
          placeholder="Téléphone"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <Text style={[styles.section, { marginTop: 12 }]}>Mode de paiement</Text>
        <Pressable
          testID="pay-mobile"
          style={[styles.payCard, method === "mobile" && styles.payCardActive]}
          onPress={() => setMethod("mobile")}
        >
          <Icon name="smartphone" size={20} color={colors.onSurface} />
          <View style={{ flex: 1 }}>
            <Text style={styles.payTitle}>Mobile Money</Text>
            <Text style={styles.paySub}>
              Orange · MTN · Moov {isLive ? "" : "(mode démo)"}
            </Text>
          </View>
          {method === "mobile" && <Icon name="check-circle" size={20} color={colors.brandSecondary} />}
        </Pressable>

        {method === "mobile" && (
          <View style={styles.momoBox}>
            <View style={styles.opRow}>
              {OPERATORS.map((o) => {
                const active = operator === o.id;
                return (
                  <Pressable
                    key={o.id}
                    testID={`operator-${o.id}`}
                    style={[styles.opCard, active && { borderColor: o.color, borderWidth: 2 }]}
                    onPress={() => setOperator(o.id)}
                  >
                    <View style={[styles.opBadge, { backgroundColor: o.color }]}>
                      <Text style={[styles.opBadgeTxt, { color: o.onColor }]}>{o.short}</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.opName}>{o.name.replace(" Mobile Money", " MoMo")}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              testID="input-momo-phone"
              style={styles.input}
              placeholder={`Numéro ${op.name} (ex : 07 00 00 00)`}
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              value={momoPhone}
              onChangeText={setMomoPhone}
            />
            <Text style={styles.momoHint}>
              Vous recevrez une demande de validation sur ce numéro. Laissez vide pour utiliser le téléphone de livraison.
            </Text>
          </View>
        )}

        <Pressable
          testID="pay-card"
          style={[styles.payCard, method === "card" && styles.payCardActive]}
          onPress={() => setMethod("card")}
        >
          <Icon name="credit-card" size={20} color={colors.onSurface} />
          <View style={{ flex: 1 }}>
            <Text style={styles.payTitle}>Carte bancaire</Text>
            <Text style={styles.paySub}>Visa · Mastercard (Simulation)</Text>
          </View>
          {method === "card" && <Icon name="check-circle" size={20} color={colors.brandSecondary} />}
        </Pressable>

        <Pressable
          testID="place-order"
          style={[styles.placeBtn, !canPay && { opacity: 0.5 }]}
          disabled={!canPay || busy}
          onPress={() => (method === "mobile" ? momo.mutate() : place.mutate())}
        >
          {busy ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <Text style={styles.placeText}>
                {method === "mobile" ? `Payer avec ${op.name}` : "Confirmer et payer"}
              </Text>
              <Icon name="lock" size={16} color={colors.onBrandPrimary} />
            </>
          )}
        </Pressable>

        {(place.isError || momo.isError || payError) && (
          <Text testID="checkout-error" style={{ color: colors.error, textAlign: "center" }}>
            {payError || (place.error as any)?.message || (momo.error as any)?.message || "Erreur de paiement"}
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Step({ n, txt }: { n: string; txt: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumTxt}>{n}</Text>
      </View>
      <Text style={styles.stepTxt}>{txt}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "500", color: colors.onSurface },
  section: { fontSize: 15, fontWeight: "500", color: colors.onSurface },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 14, fontSize: 14, color: colors.onSurface,
    backgroundColor: colors.surfaceTertiary,
  },
  payCard: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 16,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
  },
  payCardActive: { borderColor: colors.brandSecondary, backgroundColor: colors.surfaceSecondary },
  payTitle: { fontSize: 14, fontWeight: "500", color: colors.onSurface },
  paySub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  momoBox: {
    gap: 12, padding: 14, borderRadius: 12, backgroundColor: colors.surfaceTertiary,
    borderWidth: 1, borderColor: colors.border, marginTop: -6,
  },
  opRow: { flexDirection: "row", gap: 8 },
  opCard: {
    flex: 1, alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  opBadge: { width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  opBadgeTxt: { fontWeight: "500", fontSize: 12 },
  opName: { fontSize: 11, color: colors.onSurface, fontWeight: "500" },
  momoHint: { fontSize: 11, color: colors.muted, lineHeight: 16 },
  opBadgeBig: { width: 88, height: 88, borderRadius: 999, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  opBadgeBigTxt: { fontWeight: "500", fontSize: 20 },
  stepsCard: {
    alignSelf: "stretch", gap: 12, padding: 16, borderRadius: 12, backgroundColor: colors.surfaceTertiary,
    borderWidth: 1, borderColor: colors.border, marginTop: 8,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepNum: { width: 24, height: 24, borderRadius: 999, backgroundColor: colors.surfaceInverse, alignItems: "center", justifyContent: "center" },
  stepNumTxt: { color: colors.onSurfaceInverse, fontSize: 12, fontWeight: "500" },
  stepTxt: { flex: 1, color: colors.onSurface, fontSize: 13 },
  linkBtn: { padding: 10 },
  linkTxt: { color: colors.brandSecondary, fontWeight: "500", fontSize: 13 },
  ghostBtn: { marginTop: 4, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  ghostTxt: { color: colors.onSurface, fontWeight: "500", fontSize: 13 },
  placeBtn: {
    marginTop: 12, backgroundColor: colors.brandPrimary, paddingVertical: 16,
    borderRadius: 999,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  placeText: { color: colors.onBrandPrimary, fontWeight: "500", fontSize: 15 },
  doneWrap: {
    flex: 1, backgroundColor: colors.surface, alignItems: "center",
    justifyContent: "center", padding: 32, gap: 12,
  },
  doneBadge: {
    width: 88, height: 88, borderRadius: 999, backgroundColor: colors.success,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  doneTitle: { fontSize: 22, fontWeight: "500", color: colors.onSurface, textAlign: "center", letterSpacing: -0.5 },
  doneSub: { color: colors.muted, textAlign: "center", fontSize: 14, lineHeight: 20 },
  doneCta: {
    marginTop: 20, backgroundColor: colors.brandPrimary,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999,
  },
  doneCtaText: { color: colors.onBrandPrimary, fontWeight: "500", fontSize: 14 },
});
