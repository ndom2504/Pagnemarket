import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { uploadImage } from "@/src/api";
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

type Props = {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
};

type Source = "camera" | "gallery";

/**
 * Photo picker with contextual permission handling (check -> explain -> request -> settings fallback).
 */
export function PhotoPicker({ images, onChange, max = 5 }: Props) {
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
      quality: 0.75,
      allowsMultipleSelection: source === "gallery",
      selectionLimit: Math.max(1, max - images.length),
      allowsEditing: false,
    };
    const result =
      source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const a of result.assets.slice(0, max - images.length)) {
        const up = await uploadImage(a);
        urls.push(up.url);
      }
      onChange([...images, ...urls]);
    } catch (e: any) {
      setError(e.message || "Échec de l'envoi");
    } finally {
      setUploading(false);
    }
  };

  const remove = (url: string) => onChange(images.filter((u) => u !== url));

  const openSettings = () => {
    setBlocked(null);
    Linking.openSettings();
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.grid}>
        {images.map((u, i) => (
          <View key={u} style={styles.thumbWrap} testID={`photo-thumb-${i}`}>
            <Image source={{ uri: u }} style={styles.thumb} contentFit="cover" />
            {i === 0 && (
              <View style={styles.mainBadge}>
                <Text style={styles.mainBadgeTxt}>Principale</Text>
              </View>
            )}
            <Pressable testID={`photo-remove-${i}`} style={styles.removeBtn} onPress={() => remove(u)}>
              <Icon name="x" size={12} color={colors.onSurfaceInverse} />
            </Pressable>
          </View>
        ))}
        {images.length < max && (
          <Pressable
            testID="photo-add"
            style={styles.addBtn}
            onPress={() => setSheet(true)}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={colors.brandSecondary} />
            ) : (
              <>
                <Icon name="camera" size={22} color={colors.brandSecondary} />
                <Text style={styles.addTxt}>Ajouter</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
      <Text style={styles.hint}>
        {images.length}/{max} photos · La première est la photo principale
      </Text>
      {error && <Text style={styles.err}>{error}</Text>}

      {/* Source sheet */}
      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Ajouter une photo</Text>
            <Pressable testID="source-camera" style={styles.sheetRow} onPress={() => start("camera")}>
              <View style={styles.sheetIcon}><Icon name="camera" size={18} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetLbl}>Prendre une photo</Text>
                <Text style={styles.sheetSub}>Photographiez votre tissu maintenant</Text>
              </View>
            </Pressable>
            <Pressable testID="source-gallery" style={styles.sheetRow} onPress={() => start("gallery")}>
              <View style={styles.sheetIcon}><Icon name="image" size={18} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetLbl}>Choisir dans la galerie</Text>
                <Text style={styles.sheetSub}>Jusqu'à {max - images.length} photos</Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Pre-permission explanation */}
      <Modal visible={!!explain} transparent animationType="fade" onRequestClose={() => setExplain(null)}>
        <View style={styles.backdropCenter}>
          <View style={styles.dialog}>
            <View style={styles.dialogIcon}>
              <Icon name={explain === "camera" ? "camera" : "image"} size={24} color={colors.onBrandSecondary} />
            </View>
            <Text style={styles.dialogTitle}>
              {explain === "camera" ? "Accès à l'appareil photo" : "Accès à vos photos"}
            </Text>
            <Text style={styles.dialogTxt}>
              {explain === "camera"
                ? "PagneMarket utilise votre appareil photo pour photographier vos tissus et les publier dans votre boutique."
                : "PagneMarket accède à votre galerie pour publier les photos de vos tissus dans votre boutique."}
            </Text>
            <Pressable testID="perm-continue" style={styles.dialogBtn} onPress={confirmExplain}>
              <Text style={styles.dialogBtnTxt}>Continuer</Text>
            </Pressable>
            <Pressable onPress={() => setExplain(null)} style={{ padding: 10 }}>
              <Text style={{ color: colors.muted }}>Plus tard</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Blocked -> settings */}
      <Modal visible={!!blocked} transparent animationType="fade" onRequestClose={() => setBlocked(null)}>
        <View style={styles.backdropCenter}>
          <View style={styles.dialog}>
            <View style={[styles.dialogIcon, { backgroundColor: colors.surfaceInverse }]}>
              <Icon name="lock" size={22} color={colors.onSurfaceInverse} />
            </View>
            <Text style={styles.dialogTitle}>Permission refusée</Text>
            <Text style={styles.dialogTxt}>
              Autorisez l'accès {blocked === "camera" ? "à l'appareil photo" : "aux photos"} dans les réglages pour
              ajouter des photos de vos tissus.
            </Text>
            <Pressable testID="perm-settings" style={styles.dialogBtn} onPress={openSettings}>
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  thumbWrap: { width: 96, height: 96, borderRadius: 12, overflow: "hidden", backgroundColor: colors.surfaceSecondary },
  thumb: { width: "100%", height: "100%" },
  mainBadge: {
    position: "absolute", bottom: 6, left: 6, backgroundColor: colors.surfaceInverse,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
  },
  mainBadgeTxt: { color: colors.onSurfaceInverse, fontSize: 9, fontWeight: "500" },
  removeBtn: {
    position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 999,
    backgroundColor: colors.surfaceInverse, alignItems: "center", justifyContent: "center",
  },
  addBtn: {
    width: 96, height: 96, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed",
    borderColor: colors.brandSecondary, alignItems: "center", justifyContent: "center", gap: 4,
    backgroundColor: colors.surfaceTertiary,
  },
  addTxt: { color: colors.brandSecondary, fontSize: 12, fontWeight: "500" },
  hint: { color: colors.muted, fontSize: 12 },
  err: { color: colors.error, fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: "rgba(17,17,17,0.5)", justifyContent: "flex-end" },
  backdropCenter: { flex: 1, backgroundColor: "rgba(17,17,17,0.5)", justifyContent: "center", padding: 24 },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, gap: 6,
  },
  sheetTitle: { fontSize: 17, fontWeight: "500", color: colors.onSurface, marginBottom: 8 },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  sheetIcon: {
    width: 44, height: 44, borderRadius: 999, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  sheetLbl: { fontSize: 15, fontWeight: "500", color: colors.onSurface },
  sheetSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  dialog: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, alignItems: "center", gap: 10 },
  dialogIcon: {
    width: 56, height: 56, borderRadius: 999, backgroundColor: colors.brandSecondary,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  dialogTitle: { fontSize: 18, fontWeight: "500", color: colors.onSurface, textAlign: "center" },
  dialogTxt: { color: colors.muted, textAlign: "center", lineHeight: 20, fontSize: 14 },
  dialogBtn: {
    marginTop: 8, backgroundColor: colors.brandPrimary, paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: 999, alignSelf: "stretch", alignItems: "center",
  },
  dialogBtnTxt: { color: colors.onBrandPrimary, fontWeight: "500" },
});
