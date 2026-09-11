import {
  EncodingType,
  FileSystemSessionType,
  FileSystemUploadType,
  getInfoAsync,
  readAsStringAsync,
  uploadAsync,
} from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { Platform } from "react-native";

export const API_BASE_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || "https://pagnemarket.vercel.app")
  .replace(/\/$/, "")
  .replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, "https://pagnemarket.vercel.app");

const MAX_BYTES = 900 * 1024;

export function mediaUrl(url?: string | null) {
  if (!url) return "";
  if (/^(file:|data:|content:|ph:|assets-library:)/i.test(url)) return url;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)) {
    return url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, API_BASE_URL);
  }
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${API_BASE_URL}${path.startsWith("/api") ? path : `/api${path}`}`;
}

export type PreparedImage = { uri: string; fileName: string; mimeType: "image/jpeg"; base64?: string };

function stripDataUrl(raw: string) {
  const s = String(raw || "").trim();
  if (s.includes(",") && s.toLowerCase().startsWith("data:")) return s.split(",", 1)[1];
  return s;
}

export async function prepareImageUpload(uri: string, fallbackBase64?: string | null): Promise<PreparedImage> {
  const fileName = `photo-${Date.now()}.jpg`;
  try {
    let width = 960;
    let compress = 0.62;
    let out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width } }], {
      compress,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    for (let i = 0; i < 4; i += 1) {
      const size = await fileSize(out.uri);
      if (!size || size <= MAX_BYTES) break;
      width = Math.max(480, Math.round(width * 0.75));
      compress = Math.max(0.38, compress - 0.1);
      out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width } }], {
        compress,
        format: ImageManipulator.SaveFormat.JPEG,
      });
    }
    return { uri: out.uri, fileName, mimeType: "image/jpeg" };
  } catch {
    return { uri, fileName, mimeType: "image/jpeg", base64: stripDataUrl(fallbackBase64 || "") || undefined };
  }
}

async function fileSize(uri: string) {
  try {
    const info = await getInfoAsync(uri);
    return info.exists && "size" in info ? Number(info.size) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function readImageBase64(uri: string, fallback?: string | null) {
  const fromFallback = stripDataUrl(fallback || "");
  try {
    const data = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
    if (data?.trim()) return data.trim();
  } catch {
    /* use fallback */
  }
  if (fromFallback) return fromFallback;
  throw new Error("Impossible de lire la photo sur l'appareil.");
}

export async function uploadAvatarBinary(prepared: PreparedImage, token: string) {
  const url = `${API_BASE_URL}/api/profile/avatar`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": prepared.mimeType,
    "X-File-Name": prepared.fileName,
  };

  if (Platform.OS === "web") {
    const body = await (await fetch(prepared.uri)).blob();
    const response = await fetch(url, { method: "POST", headers, body });
    return { status: response.status, body: await response.text() };
  }

  const response = await uploadAsync(url, prepared.uri, {
    httpMethod: "POST",
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    sessionType: FileSystemSessionType.FOREGROUND,
    headers,
  });
  return { status: response.status, body: response.body || "" };
}
