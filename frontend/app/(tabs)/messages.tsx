import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { ConversationInbox } from "@/src/components/conversation-inbox";
import { NotificationBell } from "@/src/components/notification-bell";
import { colors } from "@/src/theme";

export default function Messages() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const convs = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api("/conversations"),
    enabled: !!user,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Messages</Text>
        {user ? <NotificationBell testID="messages-notif-bell" /> : <View style={{ width: 40 }} />}
      </View>
      {!user ? (
        <View style={styles.guest}>
          <Text style={styles.guestTitle}>Connectez-vous pour messager</Text>
          <Text style={styles.guestSub}>
            Parcourez librement la boutique. Un compte est requis pour contacter fournisseurs et tailleurs.
          </Text>
          <Pressable testID="messages-login" style={styles.guestBtn} onPress={() => router.push("/auth")}>
            <Text style={styles.guestBtnTxt}>Se connecter</Text>
          </Pressable>
        </View>
      ) : (
        <ConversationInbox
          data={(convs.data as any[]) || []}
          loading={convs.isLoading}
          myUserId={user?.id}
          emptyTitle="Aucune conversation"
          emptySub="Contactez un fournisseur depuis un produit, ou un tailleur pour faire coudre votre tissu."
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  title: { fontSize: 28, fontWeight: "500", color: colors.onSurface, letterSpacing: -0.5 },
  guest: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  guestTitle: { fontSize: 17, fontWeight: "600", color: colors.onSurface, textAlign: "center" },
  guestSub: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  guestBtn: {
    marginTop: 8,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
  },
  guestBtnTxt: { color: colors.onBrandPrimary, fontWeight: "600" },
});
