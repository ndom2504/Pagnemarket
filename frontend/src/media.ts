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

const MAX_BYTES = 1.8 * 1024 * 1024;

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

export type PreparedImage = { uri: string; fileName: string; mimeType: "image/jpeg" };

export async function prepareImageUpload(uri: string): Promise<PreparedImage> {
  let width = 1280;
  let compress = 0.72;
  let out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width } }], {
    compress,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  for (let i = 0; i < 4; i += 1) {
    const size = await fileSize(out.uri);
    if (!size || size <= MAX_BYTES) break;
    width = Math.max(640, Math.round(width * 0.75));
    compress = Math.max(0.4, compress - 0.12);
    out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width } }], {
      compress,
      format: ImageManipulator.SaveFormat.JPEG,
    });
  }

  return { uri: out.uri, fileName: `photo-${Date.now()}.jpg`, mimeType: "image/jpeg" };
}

async function fileSize(uri: string) {
  try {
    const info = await getInfoAsync(uri);
    return info.exists && "size" in info ? Number(info.size) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function readImageBase64(uri: string) {
  const data = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  if (!data?.trim()) throw new Error("Impossible de lire la photo sur l'appareil");
  return data.trim();
}

export async function uploadPreparedFile(
  prepared: PreparedImage,
  token: string,
  path = "/api/uploads/image"
) {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

  if (Platform.OS === "web") {
    const blob = await (await fetch(prepared.uri)).blob();
    const form = new FormData();
    form.append("file", blob, prepared.fileName);
    const res = await fetch(url, { method: "POST", headers, body: form });
    return { status: res.status, body: await res.text() };
  }

  const result = await uploadAsync(url, prepared.uri, {
    httpMethod: "POST",
    uploadType: FileSystemUploadType.MULTIPART,
    fieldName: "file",
    mimeType: prepared.mimeType,
    sessionType: FileSystemSessionType.FOREGROUND,
    headers,
    parameters: { fileName: prepared.fileName },
  });
  return { status: result.status, body: result.body || "" };
}
