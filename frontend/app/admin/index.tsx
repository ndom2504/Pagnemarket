import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState, type ReactElement } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { PAYMENT_STATUS_LABEL } from "@/src/order-status";
import { colors } from "@/src/theme";

type Tab = "overview" | "users" | "products" | "orders" | "payments" | "messages";

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => api("/admin/stats") });
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api("/admin/users"),
    enabled: tab === "users",
  });
  const products = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => api("/admin/products"),
    enabled: tab === "products",
  });
  const orders = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => api("/admin/orders"),
    enabled: tab === "orders",
  });
  const convs = useQuery({
    queryKey: ["admin-conversations"],
    queryFn: () => api("/admin/conversations"),
    enabled: tab === "messages",
  });
  const payments = useQuery({
    queryKey: ["admin-payments"],
    queryFn: () => api("/admin/payments"),
    enabled: tab === "payments",
  });

  if (user && !(user.roles || []).includes("admin")) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.warn}>Accès réservé à l’administration</Text>
        <Pressable onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.link}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const s: any = stats.data || {};

  const handleSignOut = async () => {
    await signOut();
    router.replace("/auth");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>PagneMarket</Text>
          <Text style={styles.title}>Administration</Text>
          <Text style={styles.sub}>{user?.email}</Text>
        </View>
        <Pressable testID="admin-signout" style={styles.iconBtn} onPress={handleSignOut}>
          <Icon name="log-out" size={18} color={colors.error} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {(
          [
            ["overview", "Vue d’ensemble"],
            ["users", "Utilisateurs"],
            ["products", "Produits"],
            ["orders", "Commandes"],
            ["payments", "Paiements"],
            ["messages", "Messages"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <Pressable
            key={key}
            testID={`admin-tab-${key}`}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabTxt, tab === key && styles.tabTxtActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {tab === "overview" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          {stats.isLoading ? (
            <ActivityIndicator color={colors.brandPrimary} />
          ) : (
            <>
              <View style={styles.grid}>
                <Stat label="Utilisateurs" value={String(s.usersTotal ?? 0)} />
                <Stat label="Produits" value={String(s.products ?? 0)} />
                <Stat label="Commandes payées" value={String(s.ordersPaid ?? 0)} />
                <Stat label="CA" value={formatXAF(s.revenue || 0)} />
                <Stat label="Conversations" value={String(s.conversations ?? 0)} />
                <Stat label="Clients" value={String(s.roles?.buyer ?? 0)} />
                <Stat label="Fournisseurs" value={String(s.roles?.supplier ?? 0)} />
                <Stat label="Tailleurs" value={String(s.roles?.tailor ?? 0)} />
              </View>
              <Text style={styles.hint}>
                Connectez-vous avec ADMIN_EMAIL / ADMIN_PASSWORD. La messagerie client ↔ fournisseur ↔
                tailleur est visible dans l’onglet Messages.
              </Text>
            </>
          )}
        </ScrollView>
      )}

      {tab === "users" && (
        <ListBlock
          loading={users.isLoading}
          data={(users.data as any[]) || []}
          empty="Aucun utilisateur"
          renderItem={(u) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {u.firstName} {u.lastName}
                </Text>
                <Text style={styles.rowMeta}>{u.email}</Text>
                <Text style={styles.rowMeta}>{(u.roles || []).join(" · ")}</Text>
              </View>
            </View>
          )}
        />
      )}

      {tab === "products" && (
        <ListBlock
          loading={products.isLoading}
          data={(products.data as any[]) || []}
          empty="Aucun produit"
          renderItem={(p) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{p.name}</Text>
                <Text style={styles.rowMeta}>
                  {p.supplierName} · {formatXAF(p.promoPrice || p.price)} · stock {p.stock}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {tab === "orders" && (
        <ListBlock
          loading={orders.isLoading}
          data={(orders.data as any[]) || []}
          empty="Aucune commande"
          renderItem={(o) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{formatXAF(o.total)}</Text>
                <Text style={styles.rowMeta}>
                  {o.status} · {o.paymentStatus} · {o.city}, {o.country}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {tab === "payments" && (
        <ListBlock
          loading={payments.isLoading}
          data={(payments.data as any[]) || []}
          empty="Aucun paiement"
          renderItem={(p) => {
            const st = PAYMENT_STATUS_LABEL[p.status] || p.status;
            const ref = p.providerPaymentId || p.stripeSessionId || p.providerSessionId || p.transactionId;
            return (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {formatXAF(p.amount)} {p.currency || "XAF"} · {st}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {(p.provider || p.mode || "—") +
                      " · " +
                      (p.paymentMethod || p.operator || "—") +
                      " · commande " +
                      String(p.orderId || "").slice(0, 8)}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    Réf. {ref}
                  </Text>
                  {p.createdAt ? (
                    <Text style={styles.rowMeta}>
                      {new Date(p.createdAt).toLocaleString("fr-FR")}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}

      {tab === "messages" && (
        <ListBlock
          loading={convs.isLoading}
          data={(convs.data as any[]) || []}
          empty="Aucune conversation"
          renderItem={(c) => {
            const names = ((c.participants as any[]) || []).map((p) => p.name).join(" ↔ ");
            return (
              <Pressable
                style={styles.row}
                onPress={() => router.push(`/conversation/${c.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{names || "Conversation"}</Text>
                  <Text numberOfLines={1} style={styles.rowMeta}>
                    {c.lastMessage}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

function ListBlock({
  loading,
  data,
  empty,
  renderItem,
}: {
  loading: boolean;
  data: any[];
  empty: string;
  renderItem: (item: any) => ReactElement | null;
}) {
  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />;
  }
  if (!data.length) {
    return <Text style={styles.empty}>{empty}</Text>;
  }
  return (
    <FlatList
      data={data}
      keyExtractor={(i, idx) => i.id || String(idx)}
      contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}
      renderItem={({ item }) => <>{renderItem(item)}</>}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: colors.surface },
  warn: { color: colors.onSurface, fontSize: 16 },
  link: { color: colors.brandSecondary, fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  kicker: { fontSize: 12, letterSpacing: 1, color: colors.brandSecondary, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "600", color: colors.onSurface, letterSpacing: -0.4 },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
  },
  tabs: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  tabTxt: { fontSize: 13, color: colors.onSurface, fontWeight: "500" },
  tabTxtActive: { color: colors.onSurfaceInverse },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    width: "47%",
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statVal: { fontSize: 20, fontWeight: "600", color: colors.onSurface },
  statLbl: { fontSize: 12, color: colors.muted, marginTop: 4 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  rowMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 40 },
});
