import { storage } from "@/src/utils/storage";
import { API_BASE_URL, imageToJpegBase64 } from "@/src/media";

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

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
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
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api${path}`, { ...opts, headers });
  } catch {
    throw new ApiError("Pas de connexion. Réessayez.", 0);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new ApiError(formatApiError(data, res.status), res.status);
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
  return status ? `Erreur ${status}` : "Erreur";
}

export function friendlyUploadError(raw: string, status?: number) {
  const msg = String(raw || "").trim();
  const lower = msg.toLowerCase();
  if (status === 0 || lower.includes("network") || lower.includes("failed to fetch")) {
    return "Pas de connexion. Réessayez.";
  }
  if (status === 401 || lower.includes("not authenticated") || lower.includes("invalid token")) {
    return "Reconnectez-vous pour envoyer une photo.";
  }
  if (status === 413 || lower.includes("trop lourd") || lower.includes("too large") || lower.includes("payload")) {
    return "Photo trop lourde. Choisissez une image plus légère.";
  }
  if (status === 402) return "Stockage temporairement indisponible. Réessayez plus tard.";
  if (status === 404 || lower === "not found") {
    return "Le serveur d'images n'est pas à jour. Relancez l'application.";
  }
  if (status === 422 || lower.includes("field required")) {
    return "La photo n'a pas pu être envoyée. Réessayez.";
  }
  if (status === 405 || lower.includes("method not allowed")) {
    return "Cette action n'est pas autorisée. Rechargez l'application.";
  }
  if (lower.includes("file") && lower.includes("not found")) {
    return "Impossible de lire la photo sur l'appareil.";
  }
  if (msg) return msg;
  return "Échec de l'envoi de l'image. Réessayez.";
}

export function formatXAF(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

export async function uploadImage(
  asset: { uri: string; base64?: string | null },
  opts: { asAvatar?: boolean } = {}
) {
  const token = await loadToken();
  if (!token) throw new Error("Reconnectez-vous pour envoyer une photo.");

  const data = await imageToJpegBase64(asset.uri, asset.base64);
  try {
    const saved = await api<{ id?: string; url: string; avatar?: string }>("/uploads/image", {
      method: "POST",
      body: JSON.stringify({
        data,
        contentType: "image/jpeg",
        fileName: `photo-${Date.now()}.jpg`,
        asAvatar: !!opts.asAvatar,
      }),
    });
    if (!saved?.url) throw new Error("Le serveur n'a pas renvoyé l'adresse de la photo.");
    return saved;
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : undefined;
    throw new Error(`Échec de l'envoi : ${friendlyUploadError(e?.message || "", status)}`);
  }
}
