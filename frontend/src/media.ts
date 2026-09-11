import { File, UploadType } from "expo-file-system";
import { getInfoAsync } from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";

const BASE_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || "https://pagnemarket.vercel.app").replace(/\/$/, "");
const MAX_BYTES = 1.8 * 1024 * 1024;

export function mediaUrl(url?: string | null) {
  if (!url) return "";
  if (/^(https?:|file:|data:|content:)/i.test(url)) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${BASE_URL}${path.startsWith("/api") ? path : `/api${path}`}`;
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

export async function uploadFile(prepared: PreparedImage): Promise<{ url: string; id?: string }> {
  const token = await storage.secureGet<string>("pm_token", "");
  const url = `${BASE_URL}/api/upload`;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  if (Platform.OS === "web") {
    const blob = await (await fetch(prepared.uri)).blob();
    const form = new FormData();
    form.append("file", blob, prepared.fileName);
    const res = await fetch(url, { method: "POST", headers, body: form });
    const data = JSON.parse(await res.text());
    if (!res.ok) throw new Error(data?.detail || `Erreur ${res.status}`);
    return data;
  }

  const result = await new File(prepared.uri).upload(url, {
    httpMethod: "POST",
    uploadType: UploadType.MULTIPART,
    fieldName: "file",
    mimeType: prepared.mimeType,
    parameters: { filename: prepared.fileName },
    headers,
  });
  let data: any = null;
  try {
    data = result.body ? JSON.parse(result.body) : null;
  } catch {
    data = null;
  }
  if (result.status < 200 || result.status >= 300) {
    const detail = typeof data?.detail === "string" ? data.detail : data?.message;
    throw new Error(detail || `Erreur ${result.status}`);
  }
  if (!data?.url) throw new Error("URL de photo manquante");
  return data;
}
