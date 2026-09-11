import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { Icon } from "@/src/icon";
import { mediaUrl } from "@/src/media";
import { colors } from "@/src/theme";

export default function Messages() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convs = useQuery({ queryKey: ["conversations"], queryFn: () => api("/conversations") });
  const creators = useQuery({ queryKey: ["creators"], queryFn: () => api("/creators") });

  const data = (convs.data as any[]) || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {convs.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : data.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="message-circle" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>Aucune conversation</Text>
          <Text style={styles.emptySub}>
            Contactez un tailleur pour faire coudre votre tissu.
          </Text>
          <Text style={styles.section}>Tailleurs</Text>
          <FlatList
            data={(creators.data as any[]) || []}
            keyExtractor={(i) => i.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 4, gap: 12 }}
            renderItem={({ item }) => (
              <Pressable
                testID={`chat-creator-${item.id}`}
                style={styles.creatorPill}
                onPress={() => router.push(`/creator/${item.id}`)}
              >
                <Image source={{ uri: mediaUrl(item.avatar) }} style={styles.avatar} contentFit="cover" />
                <Text style={styles.creatorName}>{item.name}</Text>
              </Pressable>
            )}
          />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => {
            const other = (item.participants as any[]).find((p: any) => p.id !== item.participants[0].id);
            return (
              <Pressable style={styles.convRow} testID={`conv-${item.id}`}>
                <View style={styles.convAvatar}>
                  <Text style={{ color: colors.onSurfaceInverse, fontWeight: "500" }}>
                    {(other?.name || "?").charAt(0)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.convName}>{other?.name}</Text>
                  <Text numberOfLines={1} style={styles.convLast}>
                    {item.lastMessage}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: { fontSize: 28, fontWeight: "500", color: colors.onSurface, letterSpacing: -0.5 },
  empty: { padding: 24, alignItems: "center", gap: 8, marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "500", color: colors.onSurface, marginTop: 8 },
  emptySub: { color: colors.muted, textAlign: "center", fontSize: 13, marginBottom: 24 },
  section: { alignSelf: "flex-start", fontSize: 15, fontWeight: "500", marginBottom: 12, color: colors.onSurface },
  creatorPill: {
    alignItems: "center",
    gap: 6,
    width: 80,
  },
  avatar: { width: 60, height: 60, borderRadius: 999 },
  creatorName: { fontSize: 12, color: colors.onSurface, textAlign: "center" },
  convRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  convAvatar: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.surfaceInverse,
    alignItems: "center",
    justifyContent: "center",
  },
  convName: { fontWeight: "500", color: colors.onSurface, fontSize: 14 },
  convLast: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
