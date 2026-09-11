import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
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
import { useAuth } from "@/src/auth";
import { colors } from "@/src/theme";
import { Icon } from "@/src/icon";

const HERO =
  "https://images.unsplash.com/photo-1760907949889-eb62b7fd9f75?w=1200&q=80";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, signUp, sendOtp, verifyOtp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [method, setMethod] = useState<"otp" | "email">("otp");
  const [step, setStep] = useState<"form" | "code">("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [shopName, setShopName] = useState("");
  const [role, setRole] = useState<"buyer" | "supplier">("buyer");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const goHome = () => {
    router.replace(role === "supplier" && mode === "register" ? "/supplier" : "/(tabs)");
  };

  const onSendOtp = async () => {
    setErr(null);
    if (mode === "register" && (!firstName.trim() || !lastName.trim())) {
      setErr("Indiquez votre prénom et votre nom");
      return;
    }
    if (!phone.trim()) {
      setErr("Indiquez votre numéro de téléphone");
      return;
    }
    setLoading(true);
    try {
      await sendOtp(phone.trim());
      setStep("code");
    } catch (e: any) {
      setErr(e.message || "Impossible d'envoyer le SMS");
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async () => {
    setErr(null);
    setLoading(true);
    try {
      await verifyOtp({
        phone: phone.trim(),
        code: code.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        city: city.trim(),
        country: "Gabon",
        role,
        shopName: role === "supplier" && shopName.trim() ? shopName.trim() : undefined,
      });
      goHome();
    } catch (e: any) {
      setErr(e.message || "Code incorrect");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async () => {
    if (method === "otp") {
      if (step === "form") return onSendOtp();
      return onVerifyOtp();
    }
    setErr(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email.trim(), password);
      } else {
        await signUp({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          city: city.trim(),
          country: "Gabon",
          role,
          shopName: role === "supplier" && shopName.trim() ? shopName.trim() : undefined,
        });
      }
      goHome();
    } catch (e: any) {
      setErr(e.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={["rgba(17,17,17,0)", "rgba(17,17,17,0.75)", "#111111"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroContent, { paddingTop: insets.top + 24 }]}>
            <Text style={styles.brand}>PagneMarket</Text>
            <Text style={styles.tagline}>
              Le pagne africain, votre style, votre marché.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.tabs} testID="auth-tabs">
            <Pressable
              testID="tab-login"
              style={[styles.tab, mode === "login" && styles.tabActive]}
              onPress={() => {
                setMode("login");
                setStep("form");
                setErr(null);
              }}
            >
              <Text style={[styles.tabText, mode === "login" && styles.tabTextActive]}>
                Connexion
              </Text>
            </Pressable>
            <Pressable
              testID="tab-register"
              style={[styles.tab, mode === "register" && styles.tabActive]}
              onPress={() => {
                setMode("register");
                setStep("form");
                setErr(null);
              }}
            >
              <Text style={[styles.tabText, mode === "register" && styles.tabTextActive]}>
                Inscription
              </Text>
            </Pressable>
          </View>

          <View style={styles.rolesRow}>
            {(["otp", "email"] as const).map((m) => (
              <Pressable
                key={m}
                testID={`method-${m}`}
                onPress={() => {
                  setMethod(m);
                  setStep("form");
                  setErr(null);
                }}
                style={[styles.roleChip, method === m && styles.roleChipActive]}
              >
                <Text style={[styles.roleText, method === m && styles.roleTextActive]}>
                  {m === "otp" ? "SMS / OTP" : "Email"}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === "register" && (
            <>
              <View style={styles.row}>
                <TextInput
                  testID="input-firstName"
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Prénom"
                  placeholderTextColor={colors.muted}
                  value={firstName}
                  onChangeText={setFirstName}
                />
                <TextInput
                  testID="input-lastName"
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Nom"
                  placeholderTextColor={colors.muted}
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
              <TextInput
                testID="input-city"
                style={styles.input}
                placeholder="Ville"
                placeholderTextColor={colors.muted}
                value={city}
                onChangeText={setCity}
              />
              <View style={styles.rolesRow}>
                {(["buyer", "supplier"] as const).map((r) => (
                  <Pressable
                    key={r}
                    testID={`role-${r}`}
                    onPress={() => setRole(r)}
                    style={[styles.roleChip, role === r && styles.roleChipActive]}
                  >
                    <Text
                      style={[styles.roleText, role === r && styles.roleTextActive]}
                    >
                      {r === "buyer" ? "Client" : "Fournisseur"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {role === "supplier" && (
                <TextInput
                  testID="input-shopName"
                  style={styles.input}
                  placeholder="Nom de votre boutique"
                  placeholderTextColor={colors.muted}
                  value={shopName}
                  onChangeText={setShopName}
                />
              )}
            </>
          )}

          {method === "otp" ? (
            step === "form" ? (
              <TextInput
                testID="input-phone"
                style={styles.input}
                placeholder="Téléphone  +241 6X XX XX XX"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            ) : (
              <TextInput
                testID="input-otp"
                style={styles.input}
                placeholder="Code reçu par SMS"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
              />
            )
          ) : (
            <>
              <TextInput
                testID="input-email"
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                testID="input-password"
                style={styles.input}
                placeholder="Mot de passe"
                placeholderTextColor={colors.muted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </>
          )}

          {err && (
            <Text testID="auth-error" style={styles.err}>
              {err}
            </Text>
          )}

          <Pressable
            testID="auth-submit"
            style={styles.cta}
            onPress={onSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <>
                <Text style={styles.ctaText}>
                  {method === "otp"
                    ? step === "form"
                      ? "Recevoir le code SMS"
                      : "Valider le code"
                    : mode === "login"
                      ? "Se connecter"
                      : "Créer mon compte"}
                </Text>
                <Icon name="arrow-right" size={18} color={colors.onBrandPrimary} />
              </>
            )}
          </Pressable>

          <Text style={styles.legal}>
            {mode === "login"
              ? "Nouveau sur PagneMarket ? "
              : "Vous avez déjà un compte ? "}
            <Text
              testID="switch-mode"
              onPress={() => {
                setMode(mode === "login" ? "register" : "login");
                setStep("form");
                setErr(null);
              }}
              style={{ color: colors.brandSecondary }}
            >
              {mode === "login" ? "Créer un compte" : "Se connecter"}
            </Text>
            {method === "otp" && step === "code" ? (
              <Text
                testID="otp-resend"
                onPress={() => {
                  setStep("form");
                  setCode("");
                  setErr(null);
                }}
                style={{ color: colors.brandSecondary }}
              >
                {"\n"}Changer de numéro
              </Text>
            ) : null}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { height: 320, backgroundColor: colors.surfaceInverse },
  heroContent: { flex: 1, paddingHorizontal: 24, justifyContent: "flex-end", paddingBottom: 32 },
  brand: {
    fontSize: 40,
    fontWeight: "500",
    color: colors.onSurfaceInverse,
    letterSpacing: -1,
    marginBottom: 8,
  },
  tagline: { color: colors.onSurfaceInverse, fontSize: 15, opacity: 0.9, lineHeight: 22 },
  card: {
    marginTop: -20,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: colors.surfaceInverse },
  tabText: { color: colors.onSurface, fontWeight: "500" },
  tabTextActive: { color: colors.onSurfaceInverse },
  row: { flexDirection: "row", gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.onSurface,
    marginBottom: 12,
    backgroundColor: colors.surfaceTertiary,
  },
  rolesRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  roleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
  },
  roleChipActive: {
    backgroundColor: colors.brandSecondary,
    borderColor: colors.brandSecondary,
  },
  roleText: { color: colors.onSurface, fontSize: 13, fontWeight: "500" },
  roleTextActive: { color: colors.onBrandSecondary },
  err: {
    color: colors.error,
    marginBottom: 12,
    fontSize: 13,
    textAlign: "center",
  },
  cta: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 16,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  ctaText: { color: colors.onBrandPrimary, fontWeight: "500", fontSize: 15 },
  legal: { textAlign: "center", color: colors.muted, marginTop: 16, fontSize: 13 },
});
