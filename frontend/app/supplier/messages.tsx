import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { ConversationInbox } from "@/src/components/conversation-inbox";
import { NotificationBell } from "@/src/components/notification-bell";
import { colors } from "@/src/theme";

/** Messages for supplier space — no client tab bar. */
export default function SupplierMessages() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const convs = useQuery({ queryKey: ["conversations"], queryFn: () => api("/conversations") });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Messages</Text>
        <NotificationBell testID="supplier-messages-bell" />
      </View>
      <ConversationInbox
        data={(convs.data as any[]) || []}
        loading={convs.isLoading}
        myUserId={user?.id}
        emptyTitle="Aucune conversation"
        emptySub="Les messages des clients à propos de vos tissus apparaîtront ici."
      />
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
});
