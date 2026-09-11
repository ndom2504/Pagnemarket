import * as FileSystem from "expo-file-system/legacy";
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
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(formatApiError(data, res.status));
  }
  return data as T;
}

function formatApiError(data: any, status: number) {
  const raw = data && (data.detail ?? data.message);
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw[0]) {
    const first = raw[0];
    if (typeof first === "string") return first;
    if (first?.msg) return first.msg;
  }
  if (status === 422) return "Données invalides. Réessayez avec une photo plus légère.";
  return `Erreur ${status}`;
}

export function formatXAF(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

function guessMime(asset: { uri: string; fileName?: string | null; mimeType?: string | null }) {
  const named = (asset.fileName || asset.uri || "").toLowerCase();
  if (asset.mimeType && asset.mimeType !== "image") return asset.mimeType;
  if (named.endsWith(".png")) return "image/png";
  if (named.endsWith(".webp")) return "image/webp";
  if (named.endsWith(".heic") || named.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

async function readAsBase64(uri: string): Promise<string> {
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    const res = await fetch(uri);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Impossible de lire la photo"));
      reader.onload = () => {
        const text = String(reader.result || "");
        const i = text.indexOf(",");
        resolve(i >= 0 ? text.slice(i + 1) : text);
      };
      reader.readAsDataURL(blob);
    });
  }
}

export async function uploadImage(
  asset: {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
    base64?: string | null;
  },
  opts: { asAvatar?: boolean } = {}
) {
  const name = asset.fileName || `photo-${Date.now()}.jpg`;
  const type = guessMime(asset);
  const data = String(asset.base64 || "").trim() || (await readAsBase64(asset.uri));
  if (!data) throw new Error("Impossible de lire la photo");
  return api<{ id: string; url: string; avatar?: string }>("/uploads/image", {
    method: "POST",
    body: JSON.stringify({
      data,
      image: data,
      contentType: type,
      fileName: name,
      asAvatar: !!opts.asAvatar,
    }),
  });
}
