import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, formatXAF } from "@/src/api";
import { useAuth } from "@/src/auth";
import { NotificationBell } from "@/src/components/notification-bell";
import { Icon } from "@/src/icon";
import { mediaUrl } from "@/src/media";
import { sewingStatusOf } from "@/src/sewing-status";
import { colors } from "@/src/theme";

export default function TailorDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const dash = useQuery({
    queryKey: ["tailor-dashboard"],
    queryFn: () => api("/tailor/dashboard"),
    refetchInterval: 20000,
  });

  const d: any = dash.data;
  const stats = d?.stats || {};
  const creator = d?.creator || {};
  const avatar = user?.avatarUrl || user?.avatar || creator.avatar;
  const name = creator.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim();

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F7" }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.topTitle}>Atelier</Text>
        <NotificationBell testID="tailor-notif-bell" />
      </View>

      {dash.isLoading && !d ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.brandPrimary} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}
          refreshControl={<RefreshControl refreshing={dash.isRefetching} onRefresh={() => dash.refetch()} />}
          showsVerticalScrollIndicator={false}
          testID="tailor-dashboard"
        >
          {/* Header card */}
          <View style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View style={styles.avatarWrap}>
                {avatar ? (
                  <Image source={{ uri: mediaUrl(avatar) }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarLetter}>{(name || "T").charAt(0)}</Text>
                )}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.name}>{name}</Text>
                <View style={styles.badgeRow}>
                  {stats.verified ? (
                    <View style={styles.verified}>
                      <Icon name="check-circle" size={12} color="#173F35" />
                      <Text style={styles.verifiedTxt}>Profil vérifié</Text>
                    </View>
                  ) : (
                    <Text style={styles.meta}>Profil à compléter</Text>
                  )}
                </View>
                <Text style={styles.meta}>
                  {[user?.city || creator.city, user?.country || creator.country].filter(Boolean).join(" · ")}
                  {creator.specialty || user?.specialty ? ` · ${creator.specialty || user?.specialty}` : ""}
                </Text>
                <View style={styles.ratingRow}>
                  <Icon name="star" size={14} color={colors.brandTertiary} />
                  <Text style={styles.ratingTxt}>{(stats.rating || 5).toFixed(1)}</Text>
                </View>
              </View>
            </View>
            <Pressable
              testID="tailor-view-shop"
              style={styles.shopBtn}
              onPress={() => router.push(`/creator/${creator.id || user?.id}` as any)}
            >
              <Text style={styles.shopBtnTxt}>Voir ma boutique</Text>
              <Icon name="arrow-right" size={16} color={colors.onBrandPrimary} />
            </Pressable>
          </View>

          {/* Stats */}
          <View style={styles.statsGrid}>
            <Stat label="En cours" value={String(stats.ordersInProgress || 0)} />
            <Stat label="Terminées" value={String(stats.ordersDone || 0)} />
            <Stat label="Revenus" value={formatXAF(stats.revenue || 0)} />
            <Stat label="Clients" value={String(stats.clients || 0)} />
            <Stat label="Note" value={(stats.rating || 5).toFixed(1)} />
          </View>

          {/* Alerts */}
          {(d?.alerts || []).length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Alertes</Text>
              {(d.alerts as any[]).map((a, i) => (
                <View key={i} style={styles.alertRow}>
                  <Icon name="alert-circle" size={16} color={colors.brandSecondary} />
                  <Text style={styles.alertTxt}>{a.text}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Quick menu */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Menu atelier</Text>
            <View style={styles.menuGrid}>
              {[
                { href: "/tailor/creations", icon: "camera", label: "Créations" },
                { href: "/tailor/creation-form", icon: "plus", label: "Ajouter" },
                { href: "/tailor/orders", icon: "clipboard", label: "Commandes" },
                { href: "/tailor/clients", icon: "users", label: "Clients" },
                { href: "/tailor/measurements", icon: "edit-3", label: "Mesures" },
                { href: "/tailor/calendar", icon: "calendar", label: "Agenda" },
                { href: "/tailor/messages", icon: "message-circle", label: "Messages" },
                { href: "/tailor/reviews", icon: "star", label: "Avis" },
                { href: "/tailor/revenue", icon: "dollar-sign", label: "Revenus" },
                { href: "/tailor/profile", icon: "user", label: "Profil" },
                { href: "/settings", icon: "settings", label: "Réglages" },
              ].map((m) => (
                <Pressable
                  key={m.href}
                  style={styles.menuItem}
                  onPress={() => router.push(m.href as any)}
                  testID={`tailor-menu-${m.label}`}
                >
                  <View style={styles.menuIcon}>
                    <Icon name={m.icon as any} size={18} color={colors.brandPrimary} />
                  </View>
                  <Text style={styles.menuLbl}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Recent orders */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Commandes récentes</Text>
              <Pressable onPress={() => router.push("/tailor/orders")}>
                <Text style={styles.link}>Tout voir</Text>
              </Pressable>
            </View>
            {(d?.recentOrders || []).length === 0 ? (
              <Text style={styles.empty}>Aucune commande couture pour l’instant.</Text>
            ) : (
              (d.recentOrders as any[]).map((o) => {
                const st = sewingStatusOf(o.status);
                return (
                  <Pressable
                    key={o.id}
                    style={styles.listRow}
                    onPress={() => router.push("/tailor/orders")}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{o.title}</Text>
                      <Text style={styles.rowMeta}>
                        {o.clientName} · {formatXAF(o.price)}
                      </Text>
                    </View>
                    <View style={[styles.pill, { backgroundColor: st.color }]}>
                      <Text style={styles.pillTxt}>{st.label}</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>

          {/* Appointments */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Rendez-vous à venir</Text>
              <Pressable onPress={() => router.push("/tailor/calendar")}>
                <Text style={styles.link}>Agenda</Text>
              </Pressable>
            </View>
            {(d?.upcomingAppointments || []).length === 0 ? (
              <Text style={styles.empty}>Pas de rendez-vous planifié.</Text>
            ) : (
              (d.upcomingAppointments as any[]).map((a) => (
                <View key={a.id} style={styles.listRow}>
                  <Icon name="calendar" size={16} color={colors.brandTertiary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{a.title}</Text>
                    <Text style={styles.rowMeta}>
                      {a.clientName} · {new Date(a.at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Upcoming deliveries */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Prochaines livraisons</Text>
              <Pressable onPress={() => router.push("/tailor/orders")}>
                <Text style={styles.link}>Commandes</Text>
              </Pressable>
            </View>
            {(d?.upcomingDeliveries || []).length === 0 ? (
              <Text style={styles.empty}>Aucune livraison planifiée.</Text>
            ) : (
              (d.upcomingDeliveries as any[]).map((o) => (
                <View key={o.id} style={styles.listRow}>
                  <Icon name="package" size={16} color={colors.brandSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{o.title}</Text>
                    <Text style={styles.rowMeta}>
                      {o.clientName} · {String(o.dueDate).slice(0, 10)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Popular creations */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Créations populaires</Text>
              <Pressable onPress={() => router.push("/tailor/creations")}>
                <Text style={styles.link}>Gérer</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {(d?.popularCreations || []).length === 0 ? (
                <Pressable style={styles.addCreation} onPress={() => router.push("/tailor/creation-form")}>
                  <Icon name="plus" size={22} color={colors.brandTertiary} />
                  <Text style={styles.addCreationTxt}>Publier une création</Text>
                </Pressable>
              ) : (
                (d.popularCreations as any[]).map((m) => (
                  <Pressable key={m.id} style={styles.creationCard} onPress={() => router.push("/tailor/creations")}>
                    <Image source={{ uri: mediaUrl(m.image) }} style={styles.creationImg} contentFit="cover" />
                    <Text numberOfLines={1} style={styles.creationName}>
                      {m.name}
                    </Text>
                    <Text style={styles.creationPrice}>{formatXAF(m.indicativePrice)}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>

          {/* Unread messages teaser */}
          <Pressable style={styles.card} onPress={() => router.push("/tailor/messages")}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Messages</Text>
              {(stats.unreadMessages || 0) > 0 ? (
                <View style={styles.unreadPill}>
                  <Text style={styles.unreadPillTxt}>{stats.unreadMessages}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.empty}>
              {(stats.unreadMessages || 0) > 0
                ? "Des clients attendent votre réponse."
                : "Aucun message non lu."}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  topTitle: { fontSize: 22, fontWeight: "600", color: colors.onSurface, letterSpacing: -0.4 },
  headerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: colors.surfaceInverse,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: colors.brandTertiary,
  },
  avatar: { width: 72, height: 72 },
  avatarLetter: { color: colors.onSurfaceInverse, fontSize: 28, fontWeight: "600" },
  name: { fontSize: 20, fontWeight: "600", color: colors.onSurface },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  verified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8F0EC",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  verifiedTxt: { fontSize: 11, fontWeight: "600", color: "#173F35" },
  meta: { fontSize: 12, color: colors.muted },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  ratingTxt: { fontWeight: "600", color: colors.onSurface, fontSize: 13 },
  shopBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 999,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shopBtnTxt: { color: colors.onBrandPrimary, fontWeight: "600", fontSize: 14 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: {
    width: "31.5%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: "30%",
    flexGrow: 1,
  },
  statVal: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  statLbl: { fontSize: 11, color: colors.muted, marginTop: 4 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 16, fontWeight: "600", color: colors.onSurface },
  link: { color: colors.brandSecondary, fontWeight: "600", fontSize: 13 },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  alertTxt: { color: colors.onSurface, fontSize: 13, flex: 1 },
  menuGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  menuItem: { width: "23%", alignItems: "center", gap: 6, paddingVertical: 8 },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F4F1EA",
    alignItems: "center",
    justifyContent: "center",
  },
  menuLbl: { fontSize: 11, color: colors.onSurface, textAlign: "center", fontWeight: "500" },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rowTitle: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  rowMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  pillTxt: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  creationCard: { width: 140, gap: 6 },
  creationImg: { width: 140, height: 170, borderRadius: 12, backgroundColor: colors.surfaceSecondary },
  creationName: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  creationPrice: { fontSize: 12, color: colors.brandSecondary, fontWeight: "600" },
  addCreation: {
    width: 140,
    height: 170,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FAFAFA",
  },
  addCreationTxt: { fontSize: 12, color: colors.muted, textAlign: "center", paddingHorizontal: 8 },
  unreadPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadPillTxt: { color: "#FFF", fontSize: 11, fontWeight: "700" },
});
