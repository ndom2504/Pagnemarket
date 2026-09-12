import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { useAuth } from "@/src/auth";
import { Icon } from "@/src/icon";
import { mediaUrl } from "@/src/media";
import { colors } from "@/src/theme";

export default function TailorProfile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["tailor-profile"], queryFn: () => api("/tailor/profile") });

  const [bio, setBio] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [years, setYears] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const c: any = (profile.data as any)?.creator;
    if (!c) return;
    setBio(c.bio || "");
    setSpecialty(c.specialty || user?.specialty || "");
    setYears(c.yearsExperience != null ? String(c.yearsExperience) : "");
  }, [profile.data, user?.specialty]);

  const save = useMutation({
    mutationFn: () =>
      api("/tailor/profile", {
        method: "PATCH",
        body: JSON.stringify({
          bio: bio.trim() || null,
          specialty: specialty.trim() || null,
          yearsExperience: years ? Number(years) : null,
        }),
      }),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["tailor-profile"] });
      qc.invalidateQueries({ queryKey: ["tailor-dashboard"] });
      await refresh?.();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const creator: any = (profile.data as any)?.creator || {};
  const avatar = user?.avatarUrl || user?.avatar || creator.avatar;
  const name = creator.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F4F5F7" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Profil professionnel</Text>
        <View style={{ width: 40 }} />
      </View>

      {profile.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.avatarWrap}>
              {avatar ? (
                <Image source={{ uri: mediaUrl(avatar) }} style={styles.avatar} contentFit="cover" />
              ) : (
                <Text style={styles.letter}>{(name || "T").charAt(0)}</Text>
              )}
            </View>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.meta}>
              {[user?.city || creator.city, user?.country || creator.country].filter(Boolean).join(" · ")}
            </Text>
            {creator.verified || user?.emailVerified ? (
              <View style={styles.verified}>
                <Icon name="check-circle" size={12} color="#173F35" />
                <Text style={styles.verifiedTxt}>Profil vérifié</Text>
              </View>
            ) : null}
            <Pressable
              style={styles.shopBtn}
              onPress={() => router.push(`/creator/${creator.id || user?.id}` as any)}
            >
              <Text style={styles.shopTxt}>Voir ma boutique</Text>
            </Pressable>
          </View>

          <Field label="Spécialité">
            <TextInput
              style={styles.input}
              value={specialty}
              onChangeText={setSpecialty}
              placeholder="Robes, costumes, wax…"
              placeholderTextColor={colors.muted}
            />
          </Field>
          <Field label="Années d’expérience">
            <TextInput
              style={styles.input}
              value={years}
              onChangeText={setYears}
              keyboardType="numeric"
              placeholder="5"
              placeholderTextColor={colors.muted}
            />
          </Field>
          <Field label="Bio atelier">
            <TextInput
              style={[styles.input, { minHeight: 110, textAlignVertical: "top" }]}
              value={bio}
              onChangeText={setBio}
              multiline
              placeholder="Présentez votre savoir-faire…"
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Pressable style={styles.save} onPress={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.saveTxt}>{saved ? "Enregistré ✓" : "Enregistrer"}</Text>
            )}
          </Pressable>

          <Pressable style={styles.link} onPress={() => router.push("/settings")}>
            <Icon name="settings" size={16} color={colors.onSurface} />
            <Text style={styles.linkTxt}>Paramètres du compte</Text>
            <Icon name="chevron-right" size={16} color={colors.muted} />
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "600", color: colors.onSurface },
  hero: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: colors.surfaceInverse,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 6,
  },
  avatar: { width: 80, height: 80 },
  letter: { color: "#FFF", fontSize: 28, fontWeight: "600" },
  name: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  meta: { fontSize: 13, color: colors.muted },
  verified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8F5F0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 4,
  },
  verifiedTxt: { fontSize: 11, fontWeight: "600", color: "#173F35" },
  shopBtn: {
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
  },
  shopTxt: { fontWeight: "600", color: colors.brandPrimary, fontSize: 13 },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.onSurface,
  },
  save: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveTxt: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 15 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkTxt: { flex: 1, fontWeight: "500", color: colors.onSurface },
});
