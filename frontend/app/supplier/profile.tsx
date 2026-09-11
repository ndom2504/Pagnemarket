import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { Icon } from "@/src/icon";
import { mediaUrl } from "@/src/media";
import { colors } from "@/src/theme";

export default function SupplierProfile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const avatar = user?.avatarUrl || user?.avatar;

  const leave = async () => {
    await signOut();
    router.replace("/auth");
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      testID="supplier-profile"
    >
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Pressable testID="supplier-profile-avatar" onPress={() => router.push("/settings")}>
          {avatar ? (
            <Image source={{ uri: mediaUrl(avatar) }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.initial}>{(user?.firstName?.[0] || "F").toUpperCase()}</Text>
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.meta}>{user?.shopName || "Boutique"}</Text>
          {(user?.city || user?.country) && (
            <Text style={styles.meta}>{[user?.city, user?.country].filter(Boolean).join(", ")}</Text>
          )}
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 6, marginTop: 8 }}>
        <MenuRow icon="settings" label="Paramètres du compte" onPress={() => router.push("/settings")} />
        <MenuRow icon="grid" label="Mes tissus" onPress={() => router.push("/supplier/products")} />
        <MenuRow icon="plus" label="Ajouter un tissu" onPress={() => router.push("/supplier/product-form")} />
        <MenuRow icon="log-out" label="Se déconnecter" onPress={leave} danger />
      </View>
    </ScrollView>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.rowIcon, danger && { backgroundColor: "#FCE8E6" }]}>
        <Icon name={icon} size={16} color={danger ? colors.error : colors.onSurface} />
      </View>
      <Text style={[styles.rowLbl, danger && { color: colors.error }]}>{label}</Text>
      <Icon name="chevron-right" size={16} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 2,
    borderColor: colors.surfaceInverse,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceInverse },
  initial: { color: colors.onSurfaceInverse, fontSize: 24, fontWeight: "500" },
  name: { fontSize: 20, fontWeight: "500", color: colors.onSurface },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLbl: { flex: 1, fontSize: 14, fontWeight: "500", color: colors.onSurface },
});
