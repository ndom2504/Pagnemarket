import { storage } from "@/src/utils/storage";
import {
  API_BASE_URL,
  prepareImageUpload,
  readImageBase64,
  uploadPreparedFile,
  type PreparedImage,
} from "@/src/media";

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
  const res = await fetch(`${API_BASE_URL}/api${path}`, { ...opts, headers });
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
  if (typeof raw === "string") {
    if (raw.toLowerCase() === "not found") return `Cette action est introuvable sur le serveur (${status || 404}).`;
    return raw;
  }
  if (Array.isArray(raw) && raw[0]) {
    const first = raw[0];
    const loc = Array.isArray(first?.loc)
      ? first.loc.filter((x: any) => x !== "body" && x !== "response").join(".")
      : "";
    if (typeof first === "string") return first;
    if (first?.msg) return loc ? `${first.msg} (${loc})` : first.msg;
  }
  return status ? `Erreur ${status}` : "Erreur";
}

export function friendlyUploadError(raw: string, status?: number) {
  const msg = String(raw || "").trim();
  const lower = msg.toLowerCase();
  if (status === 401 || lower.includes("not authenticated") || lower.includes("invalid token")) {
    return "Reconnectez-vous pour envoyer une photo.";
  }
  if (status === 413 || lower.includes("trop lourd") || lower.includes("too large")) {
    return "Photo trop lourde. Choisissez une image plus légère.";
  }
  if (status === 402) return "Stockage temporairement indisponible. Réessayez plus tard.";
  if (status === 404 || lower === "not found" || lower.includes("not found")) {
    return "L'envoi n'a pas atteint le serveur. Vérifiez le réseau, puis réessayez.";
  }
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "Pas de connexion. Réessayez.";
  }
  if (msg) return msg;
  return status ? `Impossible d'envoyer la photo (erreur ${status}).` : "Impossible d'envoyer la photo.";
}

export function formatXAF(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

function parseUploadBody(body: string, status: number) {
  let data: any = null;
  try {
    data = body ? JSON.parse(body) : null;
  } catch {
    data = null;
  }
  if (status < 200 || status >= 300) {
    throw new Error(friendlyUploadError(formatApiError(data, status), status));
  }
  if (!data?.url) throw new Error("Le serveur n'a pas renvoyé l'adresse de la photo.");
  return data as { id?: string; url: string; avatar?: string };
}

export async function uploadImage(asset: { uri: string }, opts: { asAvatar?: boolean } = {}) {
  const token = await loadToken();
  if (!token) throw new Error("Reconnectez-vous pour envoyer une photo.");

  const prepared = await prepareImageUpload(asset.uri);
  const path = opts.asAvatar ? "/api/uploads/image?asAvatar=true" : "/api/uploads/image";

  try {
    const sent = await uploadPreparedFile(prepared, token, path);
    return parseUploadBody(sent.body, sent.status);
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.startsWith("Reconnectez") || msg.startsWith("Photo trop") || msg.startsWith("Stockage")) {
      throw e;
    }
    try {
      return await uploadImageJson(prepared, opts);
    } catch (e2: any) {
      throw new Error(friendlyUploadError(e2?.message || msg));
    }
  }
}

async function uploadImageJson(prepared: PreparedImage, opts: { asAvatar?: boolean }) {
  const data = await readImageBase64(prepared.uri);
  return api<{ id?: string; url: string; avatar?: string }>("/uploads/image", {
    method: "POST",
    body: JSON.stringify({
      data,
      image: data,
      contentType: prepared.mimeType,
      fileName: prepared.fileName,
      asAvatar: !!opts.asAvatar,
    }),
  });
}
