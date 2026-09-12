import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { API_BASE_URL } from "@/src/media";

WebBrowser.maybeCompleteAuthSession();

export function isGoogleAuthConfigured(): boolean {
  return !!(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "").trim();
}

export type GoogleAuthExtra = {
  role?: string;
  city?: string;
  country?: string;
  shopName?: string;
  specialty?: string;
};

/** Opens Google via HTTPS API (works in Expo Go). Returns idToken or null. */
export async function promptGoogleIdToken(extra: GoogleAuthExtra = {}): Promise<string | null> {
  if (!isGoogleAuthConfigured()) {
    throw new Error("Google Auth non configuré (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)");
  }
  const appRedirect = Linking.createURL("google-auth");
  const q = new URLSearchParams();
  if (extra.role) q.set("role", extra.role);
  if (extra.city) q.set("city", extra.city);
  if (extra.country) q.set("country", extra.country);
  if (extra.shopName) q.set("shopName", extra.shopName);
  if (extra.specialty) q.set("specialty", extra.specialty);
  q.set("appRedirect", appRedirect);

  const startUrl = `${API_BASE_URL}/api/auth/google/start?${q.toString()}`;
  const result = await WebBrowser.openAuthSessionAsync(startUrl, appRedirect);

  if (result.type !== "success" || !("url" in result) || !result.url) {
    return null;
  }
  const parsed = Linking.parse(result.url);
  const params = (parsed.queryParams || {}) as Record<string, string | undefined>;
  const fromQuery = params.idToken || params.id_token;
  if (fromQuery) return String(fromQuery);

  try {
    const u = new URL(result.url.replace("pagnemarket://", "https://app/").replace("exp://", "https://"));
    return u.searchParams.get("idToken") || u.searchParams.get("id_token");
  } catch {
    const m = result.url.match(/[?&#]idToken=([^&]+)/i) || result.url.match(/[?&#]id_token=([^&]+)/i);
    return m ? decodeURIComponent(m[1]) : null;
  }
}

export function googlePlatformHint(): string {
  return Platform.OS === "web" ? "web" : "native";
}
