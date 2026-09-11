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
import { PhotoPicker } from "@/src/components/photo-picker";
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80";

export default function Settings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const isSupplier = !!user?.roles?.includes("supplier");

  const [avatar, setAvatar] = useState<string | null>(user?.avatar || null);
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "");
  const [country, setCountry] = useState(user?.country || "");
  const [shopName, setShopName] = useState(user?.shopName || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAvatarChange = async (imgs: string[]) => {
    const next = imgs[0] || "";
    setAvatar(next || null);
    setError(null);
    try {
      await updateProfile({ avatar: next });
    } catch (e: any) {
      setError(e.message || "Impossible d'enregistrer la photo");
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        country: country.trim(),
        ...(isSupplier ? { shopName: shopName.trim() } : {}),
      });
      setSaved(true);
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const valid = firstName.trim().length > 0 && lastName.trim().length > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="settings-back" style={styles.iconBtn} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Paramètres du compte</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" testID="settings-screen">
        <View style={styles.avatarCard}>
          <PhotoPicker
            variant="avatar"
            images={avatar ? [avatar] : []}
            onChange={onAvatarChange}
            fallbackUri={DEFAULT_AVATAR}
          />
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <Text style={styles.section}>Identité</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Field label="Prénom" style={{ flex: 1 }}>
            <TextInput testID="settings-firstName" style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Prénom" placeholderTextColor={colors.muted} />
          </Field>
          <Field label="Nom" style={{ flex: 1 }}>
            <TextInput testID="settings-lastName" style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Nom" placeholderTextColor={colors.muted} />
          </Field>
        </View>
        <Field label="Téléphone">
          <TextInput testID="settings-phone" style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+241 …" placeholderTextColor={colors.muted} />
        </Field>

        <Text style={styles.section}>Localisation</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Field label="Ville" style={{ flex: 1 }}>
            <TextInput testID="settings-city" style={styles.input} value={city} onChangeText={setCity} placeholder="Ville" placeholderTextColor={colors.muted} />
          </Field>
          <Field label="Pays" style={{ flex: 1 }}>
            <TextInput testID="settings-country" style={styles.input} value={country} onChangeText={setCountry} placeholder="Pays" placeholderTextColor={colors.muted} />
          </Field>
        </View>

        {isSupplier && (
          <>
            <Text style={styles.section}>Boutique</Text>
            <Field label="Nom de la boutique">
              <TextInput testID="settings-shopName" style={styles.input} value={shopName} onChangeText={setShopName} placeholder="Ex : Maison Adjoua" placeholderTextColor={colors.muted} />
            </Field>
            <Text style={styles.hint}>Ce nom apparaît sur tous vos tissus dans la boutique.</Text>
          </>
        )}

        {error && <Text testID="settings-error" style={styles.err}>{error}</Text>}
        {saved && (
          <View style={styles.savedRow} testID="settings-saved">
            <Icon name="check-circle" size={16} color={colors.success} />
            <Text style={styles.savedTxt}>Modifications enregistrées</Text>
          </View>
        )}

        <Pressable
          testID="settings-save"
          style={[styles.saveBtn, !valid && { opacity: 0.5 }]}
          disabled={!valid || saving}
          onPress={save}
        >
          {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.saveTxt}>Enregistrer</Text>}
        </Pressable>
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
  avatarCard: {
    alignItems: "center", gap: 12, padding: 20, borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
  },
  email: { color: colors.muted, fontSize: 13 },
  section: { fontSize: 15, fontWeight: "500", color: colors.onSurface, marginTop: 4 },
  label: { fontSize: 13, fontWeight: "500", color: colors.onSurface },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 14,
    color: colors.onSurface, backgroundColor: colors.surfaceTertiary,
  },
  hint: { color: colors.muted, fontSize: 12 },
  err: { color: colors.error, textAlign: "center", fontSize: 13 },
  savedRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  savedTxt: { color: colors.success, fontWeight: "500", fontSize: 13 },
  saveBtn: { backgroundColor: colors.brandPrimary, paddingVertical: 16, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  saveTxt: { color: colors.onBrandPrimary, fontWeight: "500", fontSize: 15 },
});
