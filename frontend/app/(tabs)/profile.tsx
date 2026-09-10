import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, formatXAF } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Icon } from "@/src/icon";
import { PAYMENT_LABEL, statusOf } from "@/src/order-status";
import { colors } from "@/src/theme";

const AVATAR =
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => api("/orders"), enabled: !!user });
  const favs = useQuery({ queryKey: ["favorites"], queryFn: () => api("/favorites"), enabled: !!user });
  const isSupplier = !!user?.roles?.includes("supplier");

  const handleSignOut = async () => {
    await signOut();
    router.replace("/auth");
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Image source={{ uri: AVATAR }} style={styles.avatar} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.rolesRow}>
            {(user?.roles || []).map((r) => (
              <View key={r} style={styles.rolePill}>
                <Text style={styles.roleText}>
                  {r === "buyer" ? "Acheteur" : r === "supplier" ? "Fournisseur" : r === "tailor" ? "Tailleur" : r}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{((orders.data as any[]) || []).length}</Text>
          <Text style={styles.statLabel}>Commandes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{((favs.data as any[]) || []).length}</Text>
          <Text style={styles.statLabel}>Favoris</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{user?.city || "—"}</Text>
          <Text style={styles.statLabel}>Ville</Text>
        </View>
      </View>

      {/* Supplier space */}
      {isSupplier && (
        <Pressable testID="supplier-space" style={styles.supplierCard} onPress={() => router.push("/supplier")}>
          <View style={styles.supplierIcon}>
            <Icon name="bar-chart-2" size={20} color={colors.onBrandSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.supplierTitle}>Espace fournisseur</Text>
            <Text style={styles.supplierSub}>Ventes du jour, commandes en cours, vos tissus</Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.onSurfaceInverse} />
        </Pressable>
      )}

      {/* Orders */}
      <SectionHead
        title="Mes commandes récentes"
        action={((orders.data as any[]) || []).length > 0 ? "Voir tout" : undefined}
        onAction={() => router.push("/orders")}
      />
      {((orders.data as any[]) || []).length === 0 ? (
        <View style={styles.emptyCard}>
          <Icon name="package" size={28} color={colors.muted} />
          <Text style={styles.emptyTxt}>Aucune commande pour l'instant.</Text>
          <Pressable
            testID="shop-cta"
            style={styles.smallCta}
            onPress={() => router.push("/(tabs)/shop")}
          >
            <Text style={styles.smallCtaText}>Explorer la boutique</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {((orders.data as any[]) || []).slice(0, 5).map((o: any) => (
            <Pressable key={o.id} style={styles.orderRow} testID={`order-${o.id}`} onPress={() => router.push(`/order/${o.id}`)}>
              <View style={styles.orderIcon}>
                <Icon name="package" size={18} color={colors.onBrandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderTitle}>
                  {o.items.length} article{o.items.length > 1 ? "s" : ""} · {formatXAF(o.total)}
                </Text>
                <Text style={styles.orderMeta}>
                  {new Date(o.createdAt).toLocaleDateString("fr-FR")} · {PAYMENT_LABEL[o.paymentMethod] || o.paymentMethod}
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: statusOf(o.status).color }]}>
                <Text style={styles.statusTxt}>{statusOf(o.status).label}</Text>
              </View>
              <Icon name="chevron-right" size={16} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      )}

      {/* Menu */}
      <SectionHead title="Compte" />
      <View style={{ paddingHorizontal: 16, gap: 4 }}>
        {isSupplier && (
          <MenuRow icon="layers" label="Mes tissus" onPress={() => router.push("/supplier/products")} testID="menu-supplier-products" />
        )}
        <MenuRow icon="heart" label="Mes favoris" onPress={() => router.push("/(tabs)/shop")} testID="menu-favs" />
        <MenuRow icon="shopping-bag" label="Mon panier" onPress={() => router.push("/cart")} testID="menu-cart" />
        <MenuRow icon="map-pin" label="Mes adresses" onPress={() => {}} testID="menu-addresses" />
        <MenuRow icon="credit-card" label="Moyens de paiement" onPress={() => {}} testID="menu-payments" />
        <MenuRow icon="settings" label="Paramètres" onPress={() => {}} testID="menu-settings" />
        <MenuRow icon="log-out" label="Se déconnecter" onPress={handleSignOut} testID="menu-signout" danger />
      </View>
    </ScrollView>
  );
}

function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 24, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={{ fontSize: 15, fontWeight: "500", color: colors.onSurface }}>{title}</Text>
      {action && (
        <Pressable onPress={onAction} testID="orders-see-all">
          <Text style={{ color: colors.brandSecondary, fontSize: 13, fontWeight: "500" }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  testID,
  danger,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  testID?: string;
  danger?: boolean;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.menuRow}>
      <View style={[styles.menuIcon, danger && { backgroundColor: colors.brandSecondary }]}>
        <Icon name={icon} size={16} color={danger ? colors.onBrandSecondary : colors.onSurface} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: colors.brandSecondary }]}>{label}</Text>
      <Icon name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: colors.surfaceSecondary,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.surfaceInverse,
  },
  name: { fontSize: 20, fontWeight: "500", color: colors.onSurface, letterSpacing: -0.5 },
  email: { color: colors.muted, marginTop: 2, fontSize: 13 },
  rolesRow: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  rolePill: {
    backgroundColor: colors.surfaceInverse,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roleText: { color: colors.onSurfaceInverse, fontSize: 11, fontWeight: "500" },
  stats: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: -12,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stat: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 18, fontWeight: "500", color: colors.onSurface },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.divider, marginHorizontal: 8 },
  emptyCard: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 8,
  },
  emptyTxt: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  smallCta: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  smallCtaText: { color: colors.onBrandPrimary, fontWeight: "500", fontSize: 13 },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  orderTitle: { fontWeight: "500", color: colors.onSurface, fontSize: 13 },
  orderMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusTxt: { color: colors.onSurfaceInverse, fontSize: 10, fontWeight: "500" },
  supplierCard: {
    marginHorizontal: 16,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surfaceInverse,
  },
  supplierIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  supplierTitle: { color: colors.onSurfaceInverse, fontWeight: "500", fontSize: 15 },
  supplierSub: { color: colors.onSurfaceInverse, opacity: 0.7, fontSize: 12, marginTop: 2 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { flex: 1, fontSize: 14, color: colors.onSurface, fontWeight: "500" },
});
