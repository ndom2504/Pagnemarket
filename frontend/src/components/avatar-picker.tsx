import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { uploadImage } from "@/src/api";
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

type Source = "camera" | "gallery";

type Props = {
  uri?: string | null;
  initials?: string;
  onChange: (url: string) => void;
};

export function AvatarPicker({ uri, initials, onChange }: Props) {
  const [sheet, setSheet] = useState(false);
  const [explain, setExplain] = useState<Source | null>(null);
  const [blocked, setBlocked] = useState<Source | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPermission = (source: Source) =>
    source === "camera" ? ImagePicker.getCameraPermissionsAsync() : ImagePicker.getMediaLibraryPermissionsAsync();
  const requestPermission = (source: Source) =>
    source === "camera" ? ImagePicker.requestCameraPermissionsAsync() : ImagePicker.requestMediaLibraryPermissionsAsync();

  const start = async (source: Source) => {
    setSheet(false);
    setError(null);
    if (Platform.OS === "web") return launch(source);
    const current = await getPermission(source);
    if (current.granted) return launch(source);
    if (!current.canAskAgain) return setBlocked(source);
    setExplain(source);
  };

  const confirmExplain = async () => {
    const source = explain!;
    setExplain(null);
    const res = await requestPermission(source);
    if (res.granted) return launch(source);
    if (!res.canAskAgain) setBlocked(source);
  };

  const launch = async (source: Source) => {
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.55,
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
    };
    const result =
      source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const up = await uploadImage(result.assets[0], { asAvatar: true });
      onChange(up.url);
    } catch (e: any) {
      setError(e.message || "Échec de l'envoi");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ alignItems: "center" }}>
      <Pressable testID="avatar-pick" style={styles.wrap} onPress={() => setSheet(true)} disabled={uploading}>
        {uri ? (
          <Image source={{ uri }} style={styles.img} contentFit="cover" />
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.initials}>{(initials || "?").slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.badge}>
          {uploading ? (
            <ActivityIndicator size="small" color={colors.onBrandPrimary} />
          ) : (
            <Icon name="camera" size={14} color={colors.onBrandPrimary} />
          )}
        </View>
      </Pressable>
      <Text style={styles.hint}>Appuyez pour changer la photo</Text>
      {error && <Text style={styles.err}>{error}</Text>}

      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Photo de profil</Text>
            <Pressable testID="avatar-camera" style={styles.sheetRow} onPress={() => start("camera")}>
              <View style={styles.sheetIcon}>
                <Icon name="camera" size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetLbl}>Prendre une photo</Text>
                <Text style={styles.sheetSub}>Utilisez l’appareil photo</Text>
              </View>
            </Pressable>
            <Pressable testID="avatar-gallery" style={styles.sheetRow} onPress={() => start("gallery")}>
              <View style={styles.sheetIcon}>
                <Icon name="image" size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetLbl}>Choisir dans la galerie</Text>
                <Text style={styles.sheetSub}>Une photo de votre appareil</Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!explain} transparent animationType="fade" onRequestClose={() => setExplain(null)}>
        <View style={styles.backdropCenter}>
          <View style={styles.dialog}>
            <View style={styles.dialogIcon}>
              <Icon name={explain === "camera" ? "camera" : "image"} size={24} color={colors.onBrandSecondary} />
            </View>
            <Text style={styles.dialogTitle}>
              {explain === "camera" ? "Accès à l’appareil photo" : "Accès à vos photos"}
            </Text>
            <Text style={styles.dialogTxt}>
              {explain === "camera"
                ? "PagneMarket utilise l’appareil photo pour votre photo de profil."
                : "PagneMarket accède à votre galerie pour choisir une photo de profil."}
            </Text>
            <Pressable testID="avatar-perm-continue" style={styles.dialogBtn} onPress={confirmExplain}>
              <Text style={styles.dialogBtnTxt}>Continuer</Text>
            </Pressable>
            <Pressable onPress={() => setExplain(null)} style={{ padding: 10 }}>
              <Text style={{ color: colors.muted }}>Plus tard</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!blocked} transparent animationType="fade" onRequestClose={() => setBlocked(null)}>
        <View style={styles.backdropCenter}>
          <View style={styles.dialog}>
            <View style={[styles.dialogIcon, { backgroundColor: colors.surfaceInverse }]}>
              <Icon name="lock" size={22} color={colors.onSurfaceInverse} />
            </View>
            <Text style={styles.dialogTitle}>Permission refusée</Text>
            <Text style={styles.dialogTxt}>
              Autorisez l’accès {blocked === "camera" ? "à l’appareil photo" : "aux photos"} dans les réglages.
            </Text>
            <Pressable
              testID="avatar-perm-settings"
              style={styles.dialogBtn}
              onPress={() => {
                setBlocked(null);
                Linking.openSettings();
              }}
            >
              <Text style={styles.dialogBtnTxt}>Ouvrir les réglages</Text>
            </Pressable>
            <Pressable onPress={() => setBlocked(null)} style={{ padding: 10 }}>
              <Text style={{ color: colors.muted }}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 108, height: 108 },
  img: { width: 108, height: 108, borderRadius: 999, backgroundColor: colors.surfaceSecondary },
  fallback: {
    width: 108,
    height: 108,
    borderRadius: 999,
    backgroundColor: colors.surfaceInverse,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: colors.onSurfaceInverse, fontSize: 32, fontWeight: "500" },
  badge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.surface,
  },
  hint: { color: colors.muted, fontSize: 12, marginTop: 10 },
  err: { color: colors.error, fontSize: 12, marginTop: 6, textAlign: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(17,17,17,0.5)", justifyContent: "flex-end" },
  backdropCenter: { flex: 1, backgroundColor: "rgba(17,17,17,0.5)", justifyContent: "center", padding: 24 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 6,
  },
  sheetTitle: { fontSize: 17, fontWeight: "500", color: colors.onSurface, marginBottom: 8 },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetLbl: { fontSize: 15, fontWeight: "500", color: colors.onSurface },
  sheetSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  dialog: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, alignItems: "center", gap: 10 },
  dialogIcon: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  dialogTitle: { fontSize: 18, fontWeight: "500", color: colors.onSurface, textAlign: "center" },
  dialogTxt: { color: colors.muted, textAlign: "center", lineHeight: 20, fontSize: 14 },
  dialogBtn: {
    marginTop: 8,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
    alignSelf: "stretch",
    alignItems: "center",
  },
  dialogBtnTxt: { color: colors.onBrandPrimary, fontWeight: "500" },
});
