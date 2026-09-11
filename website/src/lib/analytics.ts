export type TrackEvent =
  | "app_download_click"
  | "google_play_click"
  | "app_store_click"
  | "join_community_click"
  | "vendor_signup_click"
  | "creator_signup_click"
  | "contact_click";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: TrackEvent, payload?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...payload });
  if (typeof window.gtag === "function") {
    window.gtag("event", event, payload);
  }
}
