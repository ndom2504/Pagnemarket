import { colors } from "@/src/theme";

export const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending_payment: { label: "Paiement en attente", color: colors.warning },
  confirmed: { label: "Confirmée", color: colors.brandTertiary },
  processing: { label: "En préparation", color: colors.brandSecondary },
  shipped: { label: "Expédiée", color: colors.brandPrimary },
  delivered: { label: "Livrée", color: colors.success },
  cancelled: { label: "Annulée", color: colors.muted },
};

export const SUPPLIER_STATUS_FLOW = ["confirmed", "processing", "shipped", "delivered", "cancelled"] as const;

export function statusOf(s: string) {
  return ORDER_STATUS[s] || { label: s, color: colors.muted };
}

export const PAYMENT_LABEL: Record<string, string> = {
  card: "Carte bancaire",
  mobile_money_orange: "Orange Money",
  mobile_money_mtn: "MTN MoMo",
  mobile_money_moov: "Moov Money",
};
