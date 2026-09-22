import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { PhotoPicker } from "@/src/components/photo-picker";
import { CityPicker } from "@/src/components/city-picker";
import { CountryPicker } from "@/src/components/country-picker";
import { countryByName, type Country } from "@/src/countries";
import { homeForRoles } from "@/src/home-route";
import { Icon } from "@/src/icon";
import { mediaUrl } from "@/src/media";
import { colors } from "@/src/theme";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, updateProfile, refresh, deleteAccount, signOut } = useAuth();
  const isSupplier = !!user?.roles?.includes("supplier");
  const isTailor = !!user?.roles?.includes("tailor");
  const blocks = useQuery({
    queryKey: ["blocks"],
    queryFn: () => api("/blocks"),
    enabled: !!user,
  });

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [country, setCountry] = useState<Country>(() => countryByName(user?.country));
  const [city, setCity] = useState(user?.city || "");
  const [shopName, setShopName] = useState(user?.shopName || "");
  const [specialty, setSpecialty] = useState(user?.specialty || "");
  const [avatar, setAvatar] = useState(user?.avatarUrl || user?.avatar || "");
  const [shopCover, setShopCover] = useState((user as any)?.shopCover || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const onAvatarChange = async (imgs: string[]) => {
    const next = imgs[0] || "";
    setErr(null);
    setOk(false);
    try {
      await updateProfile({ avatar: next, avatarUrl: next || null });
      setAvatar(next);
      await refresh();
      setOk(true);
    } catch (e: any) {
      setErr(e.message || "Impossible d'enregistrer la photo");
    }
  };

  const onShopCoverChange = async (imgs: string[]) => {
    const next = imgs[0] || "";
    setErr(null);
    setOk(false);
    try {
      await updateProfile({ shopCover: next || null } as any);
      setShopCover(next);
      await refresh();
      setOk(true);
    } catch (e: any) {
      setErr(e.message || "Impossible d'enregistrer la photo de boutique");
    }
  };

  const onSave = async () => {
    setErr(null);
    setOk(false);
    if (!firstName.trim() || !lastName.trim()) {
      setErr("Indiquez votre prénom et votre nom");
      return;
    }
    if ((isSupplier || isTailor) && !city.trim()) {
      setErr(isSupplier ? "Indiquez la ville de votre boutique" : "Indiquez la ville de votre atelier");
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
        specialty: isTailor ? specialty.trim() || undefined : undefined,
      });
      setOk(true);
    } catch (e: any) {
      setErr(e.message || "Impossible d'enregistrer");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Supprimer mon compte",
      "Cette action est définitive. Vos données personnelles seront anonymisées et vous serez déconnecté.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Continuer",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirmer la suppression",
              "Appuyez sur « Supprimer définitivement » pour valider.",
              [
                { text: "Annuler", style: "cancel" },
                {
                  text: "Supprimer définitivement",
                  style: "destructive",
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      await deleteAccount();
                      router.replace("/auth");
                    } catch (e: any) {
                      Alert.alert("Erreur", e.message || "Suppression impossible");
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const unblock = async (id: string) => {
    try {
      await api(`/blocks/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["blocks"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Impossible de débloquer");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable
          testID="settings-back"
          style={styles.iconBtn}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace(homeForRoles(user?.roles));
          }}
        >
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Paramètres</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 4 }}
        keyboardShouldPersistTaps="handled"
      >
        <PhotoPicker
          variant="avatar"
          images={avatar ? [mediaUrl(avatar)] : []}
          onChange={onAvatarChange}
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
            <Text style={[styles.section, { marginTop: 8 }]}>Photo de carte boutique</Text>
            <Text style={styles.hint}>Aperçu affiché sur l’accueil clients (sinon premier tissu).</Text>
            <PhotoPicker
              images={shopCover ? [mediaUrl(shopCover)] : []}
              onChange={onShopCoverChange}
              max={1}
            />
          </>
        )}

        {isTailor && (
          <>
            <Text style={styles.section}>Atelier</Text>
            <TextInput
              testID="settings-specialty"
              style={styles.input}
              placeholder="Spécialité (ex. robes, boubou)"
              placeholderTextColor={colors.muted}
              value={specialty}
              onChangeText={setSpecialty}
            />
            <Text style={styles.hint}>
              Visible par les clients de {city ? `${city}, ` : ""}
              {country.name}. Photo de carte : espace Tailleur → Profil professionnel.
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

        <Text style={styles.section}>Utilisateurs bloqués</Text>
        {((blocks.data as any[]) || []).length === 0 ? (
          <Text style={styles.hint}>Aucun utilisateur bloqué.</Text>
        ) : (
          ((blocks.data as any[]) || []).map((b) => (
            <View key={b.id || b.blockedId} style={styles.blockRow}>
              <Text style={styles.blockName} numberOfLines={1}>
                {b.name || "Utilisateur"}
              </Text>
              <Pressable onPress={() => unblock(b.blockedId)}>
                <Text style={styles.unblock}>Débloquer</Text>
              </Pressable>
            </View>
          ))
        )}

        <Text style={styles.section}>Confidentialité</Text>
        <Pressable
          style={styles.linkRow}
          onPress={() => Linking.openURL("https://pagnemarket.com/fr/privacy")}
        >
          <Text style={styles.linkTxt}>Politique de confidentialité</Text>
          <Icon name="external-link" size={16} color={colors.muted} />
        </Pressable>

        <Text style={[styles.section, { color: colors.error }]}>Zone de danger</Text>
        <Text style={styles.hint}>
          La suppression anonymise vos données personnelles. Cette action est irréversible.
        </Text>
        <Pressable
          testID="settings-delete-account"
          style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
          onPress={confirmDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <Text style={styles.deleteTxt}>Supprimer mon compte</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.signOut}
          onPress={async () => {
            await signOut();
            router.replace("/auth");
          }}
        >
          <Text style={styles.signOutTxt}>Se déconnecter</Text>
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
  blockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  blockName: { flex: 1, color: colors.onSurface, fontSize: 14 },
  unblock: { color: colors.brandSecondary, fontWeight: "600", fontSize: 13 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  linkTxt: { color: colors.onSurface, fontSize: 14 },
  deleteBtn: {
    borderWidth: 1,
    borderColor: "#E8C4C0",
    backgroundColor: "#FFF5F4",
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 8,
  },
  deleteTxt: { color: colors.error, fontWeight: "600", fontSize: 15 },
  signOut: { paddingVertical: 16, alignItems: "center", marginTop: 4 },
  signOutTxt: { color: colors.muted, fontSize: 14 },
});
