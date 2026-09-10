import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
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

export default function Checkout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Libreville");
  const [country, setCountry] = useState("Gabon");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"card" | "mobile">("card");
  const [ok, setOk] = useState(false);

  const place = useMutation({
    mutationFn: () =>
      api("/orders", {
        method: "POST",
        body: JSON.stringify({ address, city, country, phone, paymentMethod: method }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      setOk(true);
    },
  });

  if (ok) {
    return (
      <View style={styles.doneWrap}>
        <View style={styles.doneBadge}>
          <Icon name="check" size={36} color={colors.onSuccess} />
        </View>
        <Text style={styles.doneTitle}>Merci pour votre commande !</Text>
        <Text style={styles.doneSub}>
          Votre commande a été confirmée. Vous recevrez une notification dès l'expédition.
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
          testID="pay-mobile"
          style={[styles.payCard, method === "mobile" && styles.payCardActive]}
          onPress={() => setMethod("mobile")}
        >
          <Icon name="smartphone" size={20} color={colors.onSurface} />
          <View style={{ flex: 1 }}>
            <Text style={styles.payTitle}>Mobile Money</Text>
            <Text style={styles.paySub}>Orange · MTN · Moov (Bientôt disponible)</Text>
          </View>
          {method === "mobile" && <Icon name="check-circle" size={20} color={colors.brandSecondary} />}
        </Pressable>

        <Pressable
          testID="place-order"
          style={[styles.placeBtn, (!address || !phone) && { opacity: 0.5 }]}
          disabled={!address || !phone || place.isPending}
          onPress={() => place.mutate()}
        >
          {place.isPending ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <Text style={styles.placeText}>Confirmer et payer</Text>
              <Icon name="lock" size={16} color={colors.onBrandPrimary} />
            </>
          )}
        </Pressable>

        {place.isError && (
          <Text testID="checkout-error" style={{ color: colors.error, textAlign: "center" }}>
            {(place.error as any)?.message || "Erreur de paiement"}
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
