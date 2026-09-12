import { colors } from "@/src/theme";

export const SEWING_STATUS: Record<string, { label: string; color: string }> = {
  received: { label: "Commande reçue", color: colors.brandTertiary },
  measurements: { label: "Mesures", color: "#4A6FA5" },
  sewing: { label: "Confection", color: colors.brandSecondary },
  fitting: { label: "Essayage", color: "#5C4B7A" },
  done: { label: "Terminé", color: colors.success },
  delivered: { label: "Livré", color: colors.success },
  cancelled: { label: "Annulé", color: colors.muted },
};

export const SEWING_FLOW = [
  "received",
  "measurements",
  "sewing",
  "fitting",
  "done",
  "delivered",
] as const;

export function sewingStatusOf(s: string) {
  return SEWING_STATUS[s] || { label: s, color: colors.muted };
}
