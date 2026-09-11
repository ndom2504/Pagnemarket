import { storage } from "@/src/utils/storage";
import { prepareImageUpload, uploadFile } from "@/src/media";

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
    const loc = Array.isArray(first?.loc)
      ? first.loc.filter((x: any) => x !== "body" && x !== "response").join(".")
      : "";
    if (typeof first === "string") return first;
    if (first?.msg) return loc ? `${first.msg} (${loc})` : first.msg;
  }
  return `Erreur ${status}`;
}

export function formatXAF(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

export async function uploadImage(asset: { uri: string }) {
  const prepared = await prepareImageUpload(asset.uri);
  return uploadFile(prepared);
}
