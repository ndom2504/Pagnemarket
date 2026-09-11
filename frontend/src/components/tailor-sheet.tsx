import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

type Props = {
  visible: boolean;
  productName?: string;
  garment?: string;
  onClose: () => void;
};

export function TailorSheet({ visible, productName, garment, onClose }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const creators = useQuery({
    queryKey: ["creators", user?.country],
    queryFn: () =>
      api(
        user?.country
          ? `/creators?country=${encodeURIComponent(user.country)}`
          : "/creators"
      ),
    enabled: visible,
  });
  const list: any[] = (creators.data as any[]) || [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}} testID="tailor-sheet">
          <View style={styles.handle} />
          <Text style={styles.title}>Faire coudre</Text>
          <Text style={styles.sub}>
            {garment && productName
              ? `Faites coudre votre ${garment.toLowerCase()} dans « ${productName} ».`
              : "Choisissez un tailleur pour coudre le tissu que vous aimez."}
          </Text>
          <ScrollView
            style={{ maxHeight: 360 }}
            contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {list.map((c) => (
              <Pressable
                key={c.id}
                testID={`tailor-${c.id}`}
                style={styles.row}
                onPress={() => {
                  onClose();
                  router.push(`/creator/${c.id}`);
                }}
              >
                <Image source={{ uri: c.avatar }} style={styles.avatar} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{c.name}</Text>
                  <Text style={styles.meta}>
                    {[c.city, c.country].filter(Boolean).join(", ")} · {c.specialty}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(17,17,17,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    gap: 8,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: "500", color: colors.onSurface, letterSpacing: -0.5 },
  sub: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: { width: 48, height: 48, borderRadius: 999, backgroundColor: colors.surfaceSecondary },
  name: { fontWeight: "500", color: colors.onSurface, fontSize: 14 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
