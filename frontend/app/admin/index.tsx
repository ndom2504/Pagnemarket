import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, formatXAF } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Icon } from "@/src/icon";
import { PAYMENT_STATUS_LABEL } from "@/src/order-status";
import { colors } from "@/src/theme";

type Section =
  | "overview"
  | "users"
  | "buyers"
  | "sellers"
  | "tailors"
  | "admins"
  | "products"
  | "categories"
  | "orders"
  | "payments"
  | "commissions"
  | "refunds"
  | "verifications"
  | "reports"
  | "messages"
  | "banners"
  | "analytics"
  | "settings"
  | "audit";

const MENU: { id: Section; label: string; icon: any; group?: string }[] = [
  { id: "overview", label: "Vue d’ensemble", icon: "grid", group: "Pilot" },
  { id: "users", label: "Utilisateurs", icon: "users", group: "Comptes" },
  { id: "buyers", label: "Acheteurs", icon: "user", group: "Comptes" },
  { id: "sellers", label: "Vendeurs", icon: "shopping-bag", group: "Comptes" },
  { id: "tailors", label: "Tailleurs", icon: "user", group: "Comptes" },
  { id: "admins", label: "Administrateurs", icon: "shield", group: "Comptes" },
  { id: "products", label: "Produits / Catalogue", icon: "package", group: "Catalogue" },
  { id: "categories", label: "Catégories textiles", icon: "tag", group: "Catalogue" },
  { id: "orders", label: "Commandes", icon: "clipboard", group: "Ops" },
  { id: "payments", label: "Paiements / Stripe", icon: "credit-card", group: "Ops" },
  { id: "commissions", label: "Commissions", icon: "dollar-sign", group: "Ops" },
  { id: "refunds", label: "Remboursements", icon: "rotate-ccw", group: "Ops" },
  { id: "verifications", label: "Vérifications", icon: "check-circle", group: "Ops" },
  { id: "reports", label: "Avis & signalements", icon: "alert-triangle", group: "Ops" },
  { id: "messages", label: "Messages / Support", icon: "message-circle", group: "Ops" },
  { id: "banners", label: "Bannières & contenus", icon: "image", group: "Contenu" },
  { id: "analytics", label: "Stats & rapports", icon: "bar-chart-2", group: "Contenu" },
  { id: "settings", label: "Paramètres plateforme", icon: "settings", group: "Système" },
  { id: "audit", label: "Journal de sécurité", icon: "lock", group: "Système" },
];

const STATUS = {
  green: "#1F7A4D",
  orange: "#D97706",
  red: "#DC2626",
  blue: "#2563EB",
};

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const [section, setSection] = useState<Section>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(width >= 900);
  const compact = width < 760;

  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api("/admin/stats"),
    refetchInterval: 30000,
  });
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => api("/admin/overview"),
    enabled: section === "overview" || section === "analytics",
    refetchInterval: 30000,
  });

  const roleFilter =
    section === "buyers"
      ? "buyer"
      : section === "sellers"
        ? "supplier"
        : section === "tailors"
          ? "tailor"
          : section === "admins"
            ? "admin"
            : section === "users" || section === "verifications"
              ? "all"
              : null;

  const usersQ = useQuery({
    queryKey: ["admin-users", roleFilter],
    queryFn: () => api(`/admin/users${roleFilter && roleFilter !== "all" ? `?role=${roleFilter}` : ""}`),
    enabled: !!roleFilter || section === "verifications",
  });
  const productsQ = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => api("/admin/products"),
    enabled: section === "products",
  });
  const ordersQ = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => api("/admin/orders"),
    enabled: section === "orders",
  });
  const paymentsQ = useQuery({
    queryKey: ["admin-payments", section],
    queryFn: () =>
      api(
        section === "refunds"
          ? "/admin/payments?status=refunded"
          : section === "payments"
            ? "/admin/payments"
            : "/admin/payments?status=failed",
      ),
    enabled: section === "payments" || section === "refunds",
  });
  const commissionsQ = useQuery({
    queryKey: ["admin-commissions"],
    queryFn: () => api("/admin/commissions"),
    enabled: section === "commissions" || section === "analytics",
  });
  const catsQ = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => api("/admin/categories"),
    enabled: section === "categories",
  });
  const convsQ = useQuery({
    queryKey: ["admin-conversations"],
    queryFn: () => api("/admin/conversations"),
    enabled: section === "messages",
  });
  const auditQ = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => api("/admin/audit"),
    enabled: section === "audit",
  });
  const settingsQ = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => api("/admin/settings"),
    enabled: section === "settings",
  });

  const suspend = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "suspended" }) =>
      api(`/admin/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
  const verify = useMutation({
    mutationFn: ({ id, verified }: { id: string; verified: boolean }) =>
      api(`/admin/users/${id}/verify`, { method: "PATCH", body: JSON.stringify({ verified }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
  const productStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/admin/products/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });

  if (user && !(user.roles || []).includes("admin")) {
    return (
      <View style={[styles.denied, { paddingTop: insets.top }]}>
        <Icon name="shield" size={28} color={STATUS.red} />
        <Text style={styles.deniedTitle}>Accès réservé aux administrateurs</Text>
        <Pressable onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.link}>Retour à l’app</Text>
        </Pressable>
      </View>
    );
  }

  const s: any = stats.data || {};
  const ov: any = overview.data || {};
  const chart: any[] = ov.salesChart || [];
  const maxRev = Math.max(1, ...chart.map((d) => Number(d.revenue || 0)));

  const confirmSuspend = (u: any) => {
    const next = (u.accountStatus || "active") === "suspended" ? "active" : "suspended";
    Alert.alert(
      next === "suspended" ? "Suspendre le compte ?" : "Réactiver le compte ?",
      `${u.firstName || ""} ${u.lastName || ""}\n${u.email}`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: next === "suspended" ? "Suspendre" : "Réactiver",
          style: next === "suspended" ? "destructive" : "default",
          onPress: () => suspend.mutate({ id: u.id, status: next }),
        },
      ],
    );
  };

  const title = MENU.find((m) => m.id === section)?.label || "Admin";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Sidebar */}
      {(sidebarOpen || !compact) && (
        <View style={[styles.sidebar, compact && styles.sidebarCompact]}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>PagneMarket</Text>
            <Text style={styles.brandSub}>Admin</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {MENU.map((item, idx) => {
              const prev = MENU[idx - 1];
              const showGroup = item.group && item.group !== prev?.group;
              const active = section === item.id;
              return (
                <View key={item.id}>
                  {showGroup ? <Text style={styles.menuGroup}>{item.group}</Text> : null}
                  <Pressable
                    style={[styles.menuItem, active && styles.menuItemActive]}
                    onPress={() => {
                      setSection(item.id);
                      if (compact) setSidebarOpen(false);
                    }}
                    testID={`admin-nav-${item.id}`}
                  >
                    <Icon name={item.icon} size={15} color={active ? "#FFF" : "#9CA3AF"} />
                    <Text style={[styles.menuTxt, active && styles.menuTxtActive]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
          <Pressable
            style={styles.signOut}
            onPress={async () => {
              await signOut();
              router.replace("/auth");
            }}
          >
            <Icon name="log-out" size={15} color="#FCA5A5" />
            <Text style={styles.signOutTxt}>Déconnexion</Text>
          </Pressable>
        </View>
      )}

      {/* Main */}
      <View style={styles.main}>
        <View style={styles.topBar}>
          {compact ? (
            <Pressable style={styles.menuBtn} onPress={() => setSidebarOpen((v) => !v)}>
              <Icon name="menu" size={18} color="#111" />
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>{title}</Text>
            <Text style={styles.pageSub}>{user?.email} · accès admin sécurisé</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {section === "overview" && (
            <>
              <View style={styles.statsGrid}>
                <StatCard label="CA total" value={formatXAF(s.revenue || 0)} tone="blue" />
                <StatCard label="Commandes aujourd’hui" value={String(s.ordersToday ?? 0)} tone="green" />
                <StatCard label="Utilisateurs" value={String(s.usersTotal ?? 0)} tone="blue" />
                <StatCard
                  label="Vendeurs actifs"
                  value={String(s.activeSuppliers ?? s.roles?.supplier ?? 0)}
                  tone="orange"
                />
                <StatCard
                  label="Tailleurs actifs"
                  value={String(s.activeTailors ?? s.roles?.tailor ?? 0)}
                  tone="orange"
                />
                <StatCard label="Produits publiés" value={String(s.products ?? 0)} tone="green" />
                <StatCard label="Cmd en attente" value={String(s.ordersPending ?? 0)} tone="orange" />
                <StatCard label="Commissions" value={formatXAF(s.commissions || 0)} tone="red" />
              </View>

              <Text style={styles.blockTitle}>Actions rapides</Text>
              <View style={styles.quickRow}>
                <Quick label="Produits" icon="package" onPress={() => setSection("products")} />
                <Quick label="Valider vendeur" icon="check-circle" onPress={() => setSection("verifications")} />
                <Quick label="Commandes" icon="clipboard" onPress={() => setSection("orders")} />
                <Quick label="Suspendre" icon="x-circle" onPress={() => setSection("users")} />
                <Quick label="Catégories" icon="tag" onPress={() => setSection("categories")} />
                <Quick label="Rapports" icon="download" onPress={() => setSection("analytics")} />
                <Quick
                  label="Notifier"
                  icon="bell"
                  onPress={() =>
                    Alert.alert("Notification", "Ouvrez Paramètres pour envoyer une alerte plateforme, ou utilisez l’API /admin/notify.")
                  }
                />
              </View>

              <Card title="Ventes (7 jours)">
                {overview.isLoading ? (
                  <ActivityIndicator color={STATUS.blue} />
                ) : (
                  <View style={styles.chart}>
                    {chart.map((d) => (
                      <View key={d.date} style={styles.barCol}>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              { height: `${Math.max(4, (Number(d.revenue) / maxRev) * 100)}%` as any },
                            ]}
                          />
                        </View>
                        <Text style={styles.barLbl}>{d.label}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>

              <View style={styles.twoCol}>
                <Card title="Dernières commandes" style={{ flex: 1 }}>
                  {(ov.recentOrders || []).slice(0, 5).map((o: any) => (
                    <Line
                      key={o.id}
                      title={formatXAF(o.total)}
                      meta={`${o.status} · ${o.paymentStatus} · ${o.city || "—"}`}
                      pill={o.paymentStatus === "paid" ? "ok" : "warn"}
                    />
                  ))}
                  {!ov.recentOrders?.length ? <Empty /> : null}
                </Card>
                <Card title="Nouveaux utilisateurs" style={{ flex: 1 }}>
                  {(ov.newUsers || []).slice(0, 5).map((u: any) => (
                    <Line
                      key={u.id}
                      title={`${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email}
                      meta={(u.roles || []).join(" · ")}
                    />
                  ))}
                  {!ov.newUsers?.length ? <Empty /> : null}
                </Card>
              </View>

              <View style={styles.twoCol}>
                <Card title="À vérifier" style={{ flex: 1 }}>
                  {(ov.toVerify || []).slice(0, 5).map((u: any) => (
                    <Line
                      key={u.id}
                      title={u.shopName || `${u.firstName} ${u.lastName}`}
                      meta={(u.roles || []).join(" · ")}
                      action="Valider"
                      onAction={() => verify.mutate({ id: u.id, verified: true })}
                      pill="warn"
                    />
                  ))}
                  {!ov.toVerify?.length ? <Empty text="Aucune demande" /> : null}
                </Card>
                <Card title="Paiements échoués" style={{ flex: 1 }}>
                  {(ov.failedPayments || []).slice(0, 5).map((p: any) => (
                    <Line
                      key={p.id || p.transactionId}
                      title={formatXAF(p.amount || 0)}
                      meta={`${p.provider || p.mode || "—"} · ${p.status}`}
                      pill="bad"
                    />
                  ))}
                  {!ov.failedPayments?.length ? <Empty text="Aucun échec" /> : null}
                </Card>
              </View>

              <Card title="Alertes sécurité">
                {(ov.securityAlerts || []).slice(0, 6).map((a: any) => (
                  <Line
                    key={a.id}
                    title={a.action}
                    meta={`${a.adminEmail || "admin"} · ${a.target || "—"}`}
                    pill="info"
                  />
                ))}
                {!ov.securityAlerts?.length ? <Empty text="Aucune alerte récente" /> : null}
              </Card>
            </>
          )}

          {(section === "users" ||
            section === "buyers" ||
            section === "sellers" ||
            section === "tailors" ||
            section === "admins" ||
            section === "verifications") && (
            <Card title={title}>
              {usersQ.isLoading ? (
                <ActivityIndicator color={STATUS.blue} />
              ) : (
                ((usersQ.data as any[]) || [])
                  .filter((u) => (section === "verifications" ? !u.verified && ((u.roles || []).includes("supplier") || (u.roles || []).includes("tailor")) : true))
                  .map((u) => (
                    <Line
                      key={u.id}
                      title={`${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email}
                      meta={`${u.email} · ${(u.roles || []).join(" · ")} · ${u.accountStatus || "active"}${u.verified ? " · vérifié" : ""}`}
                      pill={(u.accountStatus || "active") === "suspended" ? "bad" : u.verified ? "ok" : "warn"}
                      actions={
                        <>
                          {!u.verified && ((u.roles || []).includes("supplier") || (u.roles || []).includes("tailor")) ? (
                            <MiniBtn label="Valider" onPress={() => verify.mutate({ id: u.id, verified: true })} />
                          ) : null}
                          <MiniBtn
                            label={(u.accountStatus || "active") === "suspended" ? "Activer" : "Suspendre"}
                            danger={(u.accountStatus || "active") !== "suspended"}
                            onPress={() => confirmSuspend(u)}
                          />
                        </>
                      }
                    />
                  ))
              )}
            </Card>
          )}

          {section === "products" && (
            <Card title="Catalogue">
              {productsQ.isLoading ? (
                <ActivityIndicator color={STATUS.blue} />
              ) : (
                ((productsQ.data as any[]) || []).map((p) => (
                  <Line
                    key={p.id}
                    title={p.name}
                    meta={`${p.supplierName || "—"} · ${formatXAF(p.promoPrice || p.price)} · stock ${p.stock} · ${p.status || "published"}`}
                    pill={p.status === "pending" ? "warn" : p.status === "rejected" ? "bad" : "ok"}
                    actions={
                      p.status === "pending" ? (
                        <>
                          <MiniBtn label="Publier" onPress={() => productStatus.mutate({ id: p.id, status: "published" })} />
                          <MiniBtn label="Rejeter" danger onPress={() => productStatus.mutate({ id: p.id, status: "rejected" })} />
                        </>
                      ) : null
                    }
                  />
                ))
              )}
            </Card>
          )}

          {section === "categories" && (
            <CategoriesPanel data={(catsQ.data as any[]) || []} loading={catsQ.isLoading} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-categories"] })} />
          )}

          {section === "orders" && (
            <Card title="Commandes">
              {ordersQ.isLoading ? (
                <ActivityIndicator color={STATUS.blue} />
              ) : (
                ((ordersQ.data as any[]) || []).map((o) => (
                  <Line
                    key={o.id}
                    title={formatXAF(o.total)}
                    meta={`#${String(o.id).slice(0, 8)} · ${o.status} · ${o.paymentStatus} · ${o.city || ""}`}
                    pill={o.paymentStatus === "paid" ? "ok" : "warn"}
                  />
                ))
              )}
            </Card>
          )}

          {(section === "payments" || section === "refunds") && (
            <Card title={section === "refunds" ? "Remboursements" : "Paiements"}>
              {paymentsQ.isLoading ? (
                <ActivityIndicator color={STATUS.blue} />
              ) : (
                ((paymentsQ.data as any[]) || []).map((p) => (
                  <Line
                    key={p.id || p.transactionId}
                    title={`${formatXAF(p.amount || 0)} · ${PAYMENT_STATUS_LABEL[p.status] || p.status}`}
                    meta={`${p.provider || p.mode || "—"} · ${p.paymentMethod || p.operator || "—"} · #${String(p.orderId || "").slice(0, 8)}`}
                    pill={String(p.status).toUpperCase().includes("FAIL") ? "bad" : String(p.status).toUpperCase().includes("REFUND") ? "warn" : "ok"}
                  />
                ))
              )}
            </Card>
          )}

          {section === "commissions" && (
            <Card title={`Commissions (${Math.round((s.commissionRate || 0.1) * 100)}%)`}>
              <Text style={styles.bigStat}>{formatXAF((commissionsQ.data as any)?.total || s.commissions || 0)}</Text>
              {((commissionsQ.data as any)?.items || []).slice(0, 40).map((r: any) => (
                <Line
                  key={r.orderId}
                  title={formatXAF(r.commission)}
                  meta={`Commande #${String(r.orderId).slice(0, 8)} · CA ${formatXAF(r.total)}`}
                  pill="info"
                />
              ))}
            </Card>
          )}

          {section === "reports" && (
            <Card title="Avis & signalements">
              {(ov.reports || []).map((r: any, i: number) => (
                <Line key={r.id || i} title={r.text || "Signalement"} meta={`${r.kind || "avis"} · ★${r.rating ?? "—"}`} pill="warn" />
              ))}
              {!ov.reports?.length && !overview.isLoading ? <Empty text="Aucun signalement" /> : null}
              {overview.isLoading ? <ActivityIndicator color={STATUS.blue} /> : null}
            </Card>
          )}

          {section === "messages" && (
            <Card title="Support / Messages">
              {convsQ.isLoading ? (
                <ActivityIndicator color={STATUS.blue} />
              ) : (
                ((convsQ.data as any[]) || []).map((c) => {
                  const parts = ((c.participants as any[]) || []).map((p) => p.name).filter(Boolean);
                  const when = c.updatedAt
                    ? new Date(c.updatedAt).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";
                  return (
                    <Pressable key={c.id} onPress={() => router.push(`/conversation/${c.id}`)}>
                      <Line
                        title={parts.length ? parts.join(" ↔ ") : "Conversation"}
                        meta={`${c.lastMessage || "—"} · ${when}`}
                      />
                    </Pressable>
                  );
                })
              )}
            </Card>
          )}

          {section === "banners" && (
            <Card title="Bannières & contenus">
              <Empty text="Gestion des bannières à brancher (CMS). En attendant, éditez le hero marketing du site." />
            </Card>
          )}

          {section === "analytics" && (
            <>
              <Card title="Rapport ventes">
                <View style={styles.chart}>
                  {chart.map((d) => (
                    <View key={d.date} style={styles.barCol}>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: `${Math.max(4, (Number(d.revenue) / maxRev) * 100)}%` as any }]} />
                      </View>
                      <Text style={styles.barLbl}>{d.label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.hint}>Export CSV : disponible prochainement via /admin/export.</Text>
              </Card>
              <Card title="Synthèse">
                <Line title="CA" meta={formatXAF(s.revenue || 0)} />
                <Line title="Commissions" meta={formatXAF(s.commissions || 0)} />
                <Line title="Cmd payées" meta={String(s.ordersPaid ?? 0)} />
              </Card>
            </>
          )}

          {section === "settings" && (
            <Card title="Paramètres plateforme">
              <Line title="Commission" meta={`${Math.round(((settingsQ.data as any)?.commissionRate || 0.1) * 100)} %`} />
              <Line title="Devise" meta={(settingsQ.data as any)?.currency || "XAF"} />
              <Line title="Frais livraison" meta={formatXAF((settingsQ.data as any)?.shippingFee || 2500)} />
              <Line title="Support" meta={(settingsQ.data as any)?.supportEmail || "—"} />
              <NotifyBox
                onSent={() => {
                  qc.invalidateQueries({ queryKey: ["admin-audit"] });
                  Alert.alert("Envoyé", "Notification diffusée.");
                }}
              />
            </Card>
          )}

          {section === "audit" && (
            <Card title="Journal de sécurité">
              {auditQ.isLoading ? (
                <ActivityIndicator color={STATUS.blue} />
              ) : (
                ((auditQ.data as any[]) || []).map((a) => (
                  <Line
                    key={a.id}
                    title={a.action}
                    meta={`${a.adminEmail || "admin"} · cible ${a.target || "—"} · ${a.createdAt ? new Date(a.createdAt).toLocaleString("fr-FR") : ""}`}
                    pill="info"
                  />
                ))
              )}
              {!((auditQ.data as any[]) || []).length && !auditQ.isLoading ? <Empty text="Aucune action journalisée" /> : null}
            </Card>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: keyof typeof STATUS }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.dot, { backgroundColor: STATUS[tone] }]} />
      <Text style={styles.statVal} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

function Quick({ label, icon, onPress }: { label: string; icon: any; onPress: () => void }) {
  return (
    <Pressable style={styles.quick} onPress={onPress}>
      <Icon name={icon} size={14} color={STATUS.blue} />
      <Text style={styles.quickTxt}>{label}</Text>
    </Pressable>
  );
}

function Card({ title, children, style }: { title: string; children: ReactNode; style?: any }) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={{ gap: 2 }}>{children}</View>
    </View>
  );
}

function Line({
  title,
  meta,
  pill,
  action,
  onAction,
  actions,
}: {
  title: string;
  meta?: string;
  pill?: "ok" | "warn" | "bad" | "info";
  action?: string;
  onAction?: () => void;
  actions?: ReactNode;
}) {
  const pillColor =
    pill === "ok" ? STATUS.green : pill === "warn" ? STATUS.orange : pill === "bad" ? STATUS.red : pill === "info" ? STATUS.blue : undefined;
  return (
    <View style={styles.line}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.lineTitle} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={styles.lineMeta} numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>
      {pillColor ? <View style={[styles.pill, { backgroundColor: pillColor + "22" }]}><Text style={[styles.pillTxt, { color: pillColor }]}>●</Text></View> : null}
      {actions}
      {action && onAction ? <MiniBtn label={action} onPress={onAction} /> : null}
    </View>
  );
}

function MiniBtn({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={[styles.miniBtn, danger && { borderColor: STATUS.red }]} onPress={onPress}>
      <Text style={[styles.miniBtnTxt, danger && { color: STATUS.red }]}>{label}</Text>
    </Pressable>
  );
}

function Empty({ text = "Aucune donnée" }: { text?: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

function CategoriesPanel({ data, loading, onSaved }: { data: any[]; loading: boolean; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState("wax");
  const create = useMutation({
    mutationFn: () => api("/admin/categories", { method: "POST", body: JSON.stringify({ name, group }) }),
    onSuccess: () => {
      setName("");
      onSaved();
    },
    onError: (e: any) => Alert.alert("Erreur", e.message || "Impossible"),
  });
  return (
    <Card title="Catégories textiles">
      <View style={styles.formRow}>
        <TextInput style={styles.input} placeholder="Nouvelle catégorie" placeholderTextColor="#9CA3AF" value={name} onChangeText={setName} />
        <MiniBtn label="Ajouter" onPress={() => name.trim().length >= 2 && create.mutate()} />
      </View>
      {loading ? <ActivityIndicator color={STATUS.blue} /> : null}
      {data.map((c) => (
        <Line key={c.id || c.slug} title={c.name} meta={`${c.group || "—"} · ${c.slug}`} pill="info" />
      ))}
    </Card>
  );
}

function NotifyBox({ onSent }: { onSent: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const send = useMutation({
    mutationFn: () => api("/admin/notify", { method: "POST", body: JSON.stringify({ title, body }) }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      onSent();
    },
    onError: (e: any) => Alert.alert("Erreur", e.message || "Échec"),
  });
  return (
    <View style={{ gap: 8, marginTop: 10 }}>
      <Text style={styles.cardTitle}>Envoyer une notification</Text>
      <TextInput style={styles.input} placeholder="Titre" placeholderTextColor="#9CA3AF" value={title} onChangeText={setTitle} />
      <TextInput style={[styles.input, { minHeight: 64 }]} placeholder="Message" placeholderTextColor="#9CA3AF" value={body} onChangeText={setBody} multiline />
      <MiniBtn label={send.isPending ? "…" : "Diffuser"} onPress={() => title && body && send.mutate()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: "#0B1220" },
  denied: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#F4F5F7", padding: 24 },
  deniedTitle: { fontSize: 16, fontWeight: "700", color: "#111", textAlign: "center" },
  link: { color: STATUS.blue, fontWeight: "600" },
  sidebar: {
    width: 228,
    backgroundColor: "#0B1220",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#1F2937",
    paddingTop: 10,
  },
  sidebarCompact: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 8,
  },
  brandRow: { paddingHorizontal: 14, paddingBottom: 10, gap: 2 },
  brand: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  brandSub: { color: "#6B7280", fontSize: 11 },
  menuGroup: {
    color: "#4B5563",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  menuItemActive: { backgroundColor: "#1D4ED8" },
  menuTxt: { color: "#9CA3AF", fontSize: 12, fontWeight: "500", flex: 1 },
  menuTxtActive: { color: "#FFF", fontWeight: "600" },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#1F2937",
  },
  signOutTxt: { color: "#FCA5A5", fontSize: 12, fontWeight: "600" },
  main: { flex: 1, backgroundColor: "#F3F4F6" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  menuBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  pageSub: { fontSize: 11, color: "#6B7280", marginTop: 1 },
  content: { padding: 12, gap: 10, paddingBottom: 40 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: {
    width: "48%",
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  dot: { width: 8, height: 8, borderRadius: 99, marginBottom: 6 },
  statVal: { fontSize: 16, fontWeight: "700", color: "#111827" },
  statLbl: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  blockTitle: { fontSize: 12, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  quick: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  quickTxt: { fontSize: 11, fontWeight: "600", color: "#111827" },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    gap: 6,
  },
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 4 },
  twoCol: { gap: 10 },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 120, gap: 6, paddingTop: 8 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barTrack: {
    flex: 1,
    width: "100%",
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
    justifyContent: "flex-end",
    overflow: "hidden",
    minHeight: 80,
  },
  barFill: { width: "100%", backgroundColor: STATUS.blue, borderRadius: 6 },
  barLbl: { fontSize: 9, color: "#6B7280" },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F3F4F6",
  },
  lineTitle: { fontSize: 13, fontWeight: "600", color: "#111827" },
  lineMeta: { fontSize: 11, color: "#6B7280", marginTop: 1 },
  pill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 },
  pillTxt: { fontSize: 10, fontWeight: "700" },
  miniBtn: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  miniBtnTxt: { fontSize: 11, fontWeight: "600", color: "#111827" },
  empty: { color: "#9CA3AF", fontSize: 12, paddingVertical: 8 },
  bigStat: { fontSize: 22, fontWeight: "700", color: STATUS.blue, marginBottom: 6 },
  hint: { fontSize: 11, color: "#6B7280", marginTop: 8 },
  formRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 6 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },
});
