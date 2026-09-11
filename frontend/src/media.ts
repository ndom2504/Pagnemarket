import * as ImageManipulator from "expo-image-manipulator";

export const API_BASE_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || "https://pagnemarket.vercel.app")
  .replace(/\/$/, "")
  .replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, "https://pagnemarket.vercel.app");

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

function stripDataUrl(raw: string) {
  const s = String(raw || "").trim();
  if (s.includes(",") && s.toLowerCase().startsWith("data:")) return s.split(",", 1)[1];
  return s;
}

export async function imageToJpegBase64(uri: string, fallbackBase64?: string | null): Promise<string> {
  try {
    const info = await ImageManipulator.manipulateAsync(uri, [], { compress: 1 });
    const side = Math.min(info.width || 640, info.height || 640);
    const originX = Math.max(0, Math.round(((info.width || side) - side) / 2));
    const originY = Math.max(0, Math.round(((info.height || side) - side) / 2));
    let width = Math.min(640, side);
    let compress = 0.55;
    for (let i = 0; i < 5; i += 1) {
      const out = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: { originX, originY, width: side, height: side } }, { resize: { width } }],
        { compress, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      const data = stripDataUrl(out.base64 || "");
      if (data && data.length <= 280_000) return data;
      width = Math.max(280, Math.round(width * 0.75));
      compress = Math.max(0.32, compress - 0.08);
      if (i === 4 && data) return data;
    }
  } catch {
    /* fallback below */
  }
  const fallback = stripDataUrl(fallbackBase64 || "");
  if (fallback) return fallback;
  throw new Error("Impossible de lire la photo sur l'appareil.");
}
