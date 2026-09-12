import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { Icon } from "@/src/icon";
import { mediaUrl } from "@/src/media";
import { colors } from "@/src/theme";

export default function TailorClients() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const clients = useQuery({ queryKey: ["tailor-clients"], queryFn: () => api("/tailor/clients") });
  const data = (clients.data as any[]) || [];

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F7" }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Mes clients</Text>
        <View style={{ width: 40 }} />
      </View>

      {clients.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i, idx) => i.id || i.name || String(idx)}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="users" size={40} color={colors.muted} />
              <Text style={styles.emptyTxt}>Vos clients apparaîtront via les messages et commandes.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.avatar}>
                {item.avatar ? (
                  <Image source={{ uri: mediaUrl(item.avatar) }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <Text style={styles.letter}>{(item.name || "?").charAt(0)}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name || "Client"}</Text>
                <Text style={styles.meta}>
                  {item.ordersCount || 0} commande(s)
                  {item.hasMeasures ? " · mesures" : ""}
                </Text>
                {item.lastMessage ? (
                  <Text numberOfLines={1} style={styles.last}>
                    {item.lastMessage}
                  </Text>
                ) : null}
              </View>
              <Pressable style={styles.link} onPress={() => router.push("/tailor/measurements")}>
                <Icon name="edit-3" size={16} color={colors.brandPrimary} />
              </Pressable>
            </View>
          )}
        />
      )}
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
  empty: { alignItems: "center", marginTop: 48, gap: 10, paddingHorizontal: 28 },
  emptyTxt: { color: colors.muted, textAlign: "center", fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "#FFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.surfaceInverse,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 48, height: 48 },
  letter: { color: "#FFF", fontWeight: "600" },
  name: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  meta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  last: { fontSize: 12, color: colors.muted, marginTop: 2 },
  link: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#F4F1EA",
    alignItems: "center",
    justifyContent: "center",
  },
});
