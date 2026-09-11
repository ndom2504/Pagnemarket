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
import { CityPicker } from "@/src/components/city-picker";
import { CountryPicker } from "@/src/components/country-picker";
import { DEFAULT_COUNTRY, formatPhone, type Country } from "@/src/countries";
import { homeForRoles } from "@/src/home-route";
import { colors } from "@/src/theme";
import { Icon } from "@/src/icon";

type RoleChoice = "buyer" | "supplier" | "tailor";

const HERO =
  "https://images.unsplash.com/photo-1552710307-537199cd41c0?w=1600&q=80";

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
  const [specialty, setSpecialty] = useState("");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [role, setRole] = useState<RoleChoice>("buyer");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const goHome = (roles?: string[]) => {
    router.replace(homeForRoles(roles?.length ? roles : [role]));
  };

  const requireRegisterLocation = () => {
    if (mode !== "register") return true;
    if (!firstName.trim() || !lastName.trim()) {
      setErr("Indiquez votre prénom et votre nom");
      return false;
    }
    if (!city.trim()) {
      setErr(
        role === "supplier"
          ? "Choisissez la ville de votre boutique pour être visible des clients"
          : role === "tailor"
            ? "Choisissez la ville de votre atelier"
            : "Choisissez votre ville"
      );
      return false;
    }
    if (role === "supplier" && !shopName.trim()) {
      setErr("Indiquez le nom de votre boutique");
      return false;
    }
    return true;
  };

  const onSendOtp = async () => {
    setErr(null);
    if (!requireRegisterLocation()) return;
    if (!phone.trim()) {
      setErr("Indiquez votre numéro de téléphone");
      return;
    }
    setLoading(true);
    try {
      await sendOtp(formatPhone(phone.trim(), country), country.iso);
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
      const u = await verifyOtp({
        phone: formatPhone(phone.trim(), country),
        code: code.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        city: city.trim(),
        country: country.name,
        countryIso: country.iso,
        role,
        shopName: role === "supplier" && shopName.trim() ? shopName.trim() : undefined,
        specialty: role === "tailor" && specialty.trim() ? specialty.trim() : undefined,
      });
      goHome(u.roles);
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
        const u = await signIn(email.trim(), password);
        goHome(u.roles);
      } else {
        if (!requireRegisterLocation()) {
          setLoading(false);
          return;
        }
        const u = await signUp({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          city: city.trim(),
          country: country.name,
          role,
          shopName: role === "supplier" && shopName.trim() ? shopName.trim() : undefined,
          specialty: role === "tailor" && specialty.trim() ? specialty.trim() : undefined,
        });
        goHome(u.roles);
      }
    } catch (e: any) {
      setErr(e.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surfaceInverse }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(17,17,17,0.25)", "rgba(17,17,17,0.55)", "rgba(17,17,17,0.72)"]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>PagneMarket</Text>
          <Text style={styles.tagline}>
            Le pagne africain, votre style, votre marché.
          </Text>
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
              <CountryPicker
                value={country}
                onChange={(c) => {
                  setCountry(c);
                  setCity("");
                }}
              />
              <CityPicker
                countryIso={country.iso}
                value={city}
                onChange={setCity}
                placeholder={
                  role === "supplier"
                    ? "Ville de la boutique"
                    : role === "tailor"
                      ? "Ville de l'atelier"
                      : "Ville"
                }
                testID="input-city"
              />
              <View style={styles.rolesRow}>
                {([
                  { id: "buyer" as const, label: "Client" },
                  { id: "supplier" as const, label: "Fournisseur" },
                  { id: "tailor" as const, label: "Tailleur" },
                ]).map((r) => (
                  <Pressable
                    key={r.id}
                    testID={`role-${r.id}`}
                    onPress={() => setRole(r.id)}
                    style={[styles.roleChip, role === r.id && styles.roleChipActive]}
                  >
                    <Text
                      style={[styles.roleText, role === r.id && styles.roleTextActive]}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {role === "supplier" && (
                <>
                  <TextInput
                    testID="input-shopName"
                    style={styles.input}
                    placeholder="Nom de votre boutique"
                    placeholderTextColor={colors.muted}
                    value={shopName}
                    onChangeText={setShopName}
                  />
                  <Text style={styles.hint}>
                    Les clients de {city ? `${city}, ` : ""}{country.name} verront votre boutique en priorité.
                  </Text>
                </>
              )}
              {role === "tailor" && (
                <>
                  <TextInput
                    testID="input-specialty"
                    style={styles.input}
                    placeholder="Spécialité (ex. robes, boubou, mariage)"
                    placeholderTextColor={colors.muted}
                    value={specialty}
                    onChangeText={setSpecialty}
                  />
                  <Text style={styles.hint}>
                    Les clients de {city ? `${city}, ` : ""}{country.name} pourront vous contacter pour faire coudre un tissu.
                  </Text>
                </>
              )}
            </>
          )}

          {method === "otp" && mode === "login" && step === "form" && (
            <CountryPicker value={country} onChange={setCountry} />
          )}

          {method === "otp" ? (
            step === "form" ? (
              <TextInput
                testID="input-phone"
                style={styles.input}
                placeholder={`Téléphone  ${country.dial} …`}
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
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 28,
  },
  brandBlock: { alignItems: "center", paddingHorizontal: 12 },
  brand: {
    fontSize: 36,
    fontWeight: "500",
    color: colors.onSurfaceInverse,
    letterSpacing: -1,
    marginBottom: 8,
    textAlign: "center",
  },
  tagline: {
    color: colors.onSurfaceInverse,
    fontSize: 15,
    opacity: 0.92,
    lineHeight: 22,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 28,
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
  rolesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
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
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 12, marginTop: -4 },
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
