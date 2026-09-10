import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";

const BASE_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || "https://pagnemarket.vercel.app").replace(/\/$/, "");

const KEY = "pm_token";
let cachedToken: string | null = null;

export async function setToken(token: string | null) {
  cachedToken = token;
  if (token) await storage.secureSet(KEY, token);
  else await storage.secureRemove(KEY);
}

export async function loadToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  const t = await storage.secureGet<string>(KEY, "");
  cachedToken = t ? String(t) : null;
  return cachedToken;
}

export async function api<T = any>(
  path: string,
  opts: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as any),
  };
  if (opts.auth !== false) {
    const t = await loadToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE_URL}/api${path}`, { ...opts, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `Erreur ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : "Erreur inconnue");
  }
  return data as T;
}

export function formatXAF(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

export async function uploadImage(asset: { uri: string; fileName?: string | null; mimeType?: string | null }) {
  const t = await loadToken();
  const name = asset.fileName || `photo-${Date.now()}.jpg`;
  const type = asset.mimeType || "image/jpeg";
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(asset.uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri: asset.uri, name, type } as any);
  }
  const res = await fetch(`${BASE_URL}/api/uploads/image`, {
    method: "POST",
    headers: t ? { Authorization: `Bearer ${t}` } : undefined,
    body: form,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && data.detail) || `Erreur ${res.status}`);
  return data as { id: string; url: string };
}
