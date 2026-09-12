import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { Icon } from "@/src/icon";
import { colors } from "@/src/theme";

const ITEMS = [
  { href: "/tailor", icon: "home", label: "Vue d’ensemble" },
  { href: "/tailor/creations", icon: "camera", label: "Mes créations" },
  { href: "/tailor/creation-form", icon: "plus-circle", label: "Ajouter une création" },
  { href: "/tailor/orders", icon: "clipboard", label: "Commandes" },
  { href: "/tailor/clients", icon: "users", label: "Mes clients" },
  { href: "/tailor/measurements", icon: "edit-3", label: "Mes mesures" },
  { href: "/tailor/calendar", icon: "calendar", label: "Calendrier / RDV" },
  { href: "/tailor/messages", icon: "message-circle", label: "Messages" },
  { href: "/tailor/reviews", icon: "star", label: "Avis clients" },
  { href: "/tailor/revenue", icon: "dollar-sign", label: "Revenus / Paiements" },
  { href: "/tailor/profile", icon: "user", label: "Profil professionnel" },
  { href: "/settings", icon: "settings", label: "Paramètres" },
];

export default function TailorMore() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F7" }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Menu atelier</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}>
        {ITEMS.map((item) => (
          <Pressable key={item.href} style={styles.row} onPress={() => router.push(item.href as any)}>
            <View style={styles.icon}>
              <Icon name={item.icon as any} size={18} color={colors.brandPrimary} />
            </View>
            <Text style={styles.label}>{item.label}</Text>
            <Icon name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
        ))}
        <Pressable
          style={[styles.row, { marginTop: 8 }]}
          onPress={async () => {
            await signOut();
            router.replace("/auth");
          }}
        >
          <View style={[styles.icon, { backgroundColor: "#FCE8E4" }]}>
            <Icon name="log-out" size={18} color={colors.error} />
          </View>
          <Text style={[styles.label, { color: colors.error }]}>Déconnexion</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: { fontSize: 22, fontWeight: "600", color: colors.onSurface },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#FFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F4F1EA",
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.onSurface },
});
