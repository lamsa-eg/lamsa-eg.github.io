// Media preparation for the order wizard: validation + high-quality compression.
import { optimizeImageFile } from "../image-optimize-v26.js";

export const MIME = {
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/quicktime"],
  audio: ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav"]
};
const MB = 1024 * 1024;
// Upload-friendly target for Egyptian mobile networks; stays visually lossless on phones.
const NETWORK_TARGET = 2.5 * MB;

async function toJpeg(file) {
  // HEIC/HEIF (iPhone) -> JPEG where the browser can decode it (Safari).
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  const blob = await new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("x"))), "image/jpeg", 0.88));
  return new File([blob], String(file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

async function reencode(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext("2d", { alpha: file.type === "image/png" }); g.drawImage(bmp, 0, 0); bmp.close?.();
  const type = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
  const blob = await new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("encode"))), type, 0.92));
  return new File([blob], file.name, { type: blob.type || type, lastModified: Date.now() });
}

export async function readDims(blob) {
  try { const b = await createImageBitmap(blob); const d = { w: b.width, h: b.height }; b.close?.(); return d; } catch { return { w: 0, h: 0 }; }
}

/** Returns {file, compressed} or throws an Arabic error message. */
export async function prepareImage(file, maxBytes) {
  let f = file;
  if (!MIME.image.includes(f.type)) {
    if (/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name)) { try { f = await toJpeg(f); } catch { throw new Error("صيغة HEIC مش مدعومة على المتصفح ده. حوّل الصورة لـ JPG وجرب تاني."); } }
    else throw new Error("الصيغة غير مدعومة (JPG أو PNG أو WEBP فقط)");
  }
  if (f.size <= 0) throw new Error("الصورة فارغة أو تالفة");
  const limit = Math.min(maxBytes || 8 * MB, NETWORK_TARGET);
  let out = await optimizeImageFile(f, limit, { maxDimension: 2400 });
  // Privacy: always re-encode photos so EXIF/GPS location metadata never leaves the phone.
  if (!out.compressed) { try { const clean = await reencode(out.file); if (clean.size <= limit) out = { file: clean, compressed: false }; } catch {} }
  const dims = await readDims(out.file);
  if (!dims.w) throw new Error("الصورة غير قابلة للقراءة أو تالفة");
  return { file: out.file, compressed: out.compressed || f !== file, ...dims };
}

export function checkFile(kind, file, pkg) {
  if (!MIME[kind].includes(file.type)) return kind === "video" ? "الفيديو لازم يكون MP4 أو MOV" : "صيغة الصوت لازم تكون MP3 أو M4A أو WAV";
  if (kind === "video" && !pkg?.allowVideo) return "الفيديو مش متاح في الباقة دي";
  if (kind === "audio" && !pkg?.allowAudio) return "الرسالة الصوتية مش متاحة في الباقة دي";
  const max = kind === "video" ? pkg.maxVideoBytes : pkg.maxAudioBytes;
  if (file.size <= 0) return "الملف فارغ أو تالف";
  if (file.size > max) return `الملف أكبر من ${Math.round(max / MB)}MB`;
  return "";
}
