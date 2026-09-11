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
import { AvatarPicker } from "@/src/components/avatar-picker";
import { CityPicker } from "@/src/components/city-picker";
import { CountryPicker } from "@/src/components/country-picker";
import { countryByName, type Country } from "@/src/countries";
import { Icon } from "@/src/icon";
import { mediaUrl } from "@/src/media";
import { colors } from "@/src/theme";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateProfile, refresh } = useAuth();
  const isSupplier = !!user?.roles?.includes("supplier");

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [country, setCountry] = useState<Country>(() => countryByName(user?.country));
  const [city, setCity] = useState(user?.city || "");
  const [shopName, setShopName] = useState(user?.shopName || "");
  const [avatar, setAvatar] = useState(user?.avatarUrl || user?.avatar || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}` || user?.firstName?.charAt(0) || "P";

  const onSave = async () => {
    setErr(null);
    setOk(false);
    if (!firstName.trim() || !lastName.trim()) {
      setErr("Indiquez votre prénom et votre nom");
      return;
    }
    if (isSupplier && !city.trim()) {
      setErr("Indiquez la ville de votre boutique");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        country: country.name,
        city: city.trim() || undefined,
        shopName: isSupplier ? shopName.trim() || undefined : undefined,
      });
      setOk(true);
    } catch (e: any) {
      setErr(e.message || "Impossible d'enregistrer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="settings-back" style={styles.iconBtn} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Paramètres</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 4 }}
        keyboardShouldPersistTaps="handled"
      >
        <AvatarPicker
          uri={avatar ? mediaUrl(avatar) : undefined}
          initials={initials}
          onChange={async (url) => {
            setErr(null);
            setOk(false);
            try {
              if (url) {
                setAvatar(url);
                await updateProfile({ avatarUrl: url, avatar: url });
              } else {
                await updateProfile({ avatarUrl: null, avatar: null });
                setAvatar("");
              }
              await refresh();
              setOk(true);
            } catch (e: any) {
              setErr(e.message || "Impossible d'enregistrer la photo");
            }
          }}
        />

        <Text style={styles.section}>Identité</Text>
        <View style={styles.row}>
          <TextInput
            testID="settings-firstName"
            style={[styles.input, { flex: 1 }]}
            placeholder="Prénom"
            placeholderTextColor={colors.muted}
            value={firstName}
            onChangeText={setFirstName}
          />
          <TextInput
            testID="settings-lastName"
            style={[styles.input, { flex: 1 }]}
            placeholder="Nom"
            placeholderTextColor={colors.muted}
            value={lastName}
            onChangeText={setLastName}
          />
        </View>
        <TextInput
          testID="settings-phone"
          style={styles.input}
          placeholder="Téléphone"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <Text style={styles.section}>Localisation</Text>
        <CountryPicker
          value={country}
          onChange={(c) => {
            setCountry(c);
            setCity("");
          }}
        />
        <CityPicker countryIso={country.iso} value={city} onChange={setCity} />

        {isSupplier && (
          <>
            <Text style={styles.section}>Boutique</Text>
            <TextInput
              testID="settings-shopName"
              style={styles.input}
              placeholder="Nom de votre boutique"
              placeholderTextColor={colors.muted}
              value={shopName}
              onChangeText={setShopName}
            />
            <Text style={styles.hint}>
              Les clients voient {city ? `${city}, ` : ""}
              {country.name}.
            </Text>
          </>
        )}

        {err && (
          <Text testID="settings-error" style={styles.err}>
            {err}
          </Text>
        )}
        {ok && (
          <Text testID="settings-ok" style={styles.ok}>
            Modifications enregistrées.
          </Text>
        )}

        <Pressable testID="settings-save" style={styles.save} onPress={onSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <Text style={styles.saveTxt}>Enregistrer</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
  },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "500", color: colors.onSurface },
  section: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 20,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
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
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: -4, marginBottom: 8 },
  err: { color: colors.error, textAlign: "center", marginVertical: 8, fontSize: 13 },
  ok: { color: colors.brandSecondary, textAlign: "center", marginVertical: 8, fontSize: 13 },
  save: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 12,
  },
  saveTxt: { color: colors.onBrandPrimary, fontWeight: "500", fontSize: 15 },
});
