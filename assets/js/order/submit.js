// Order submission pipeline. Contract with the existing Edge Functions:
//   create-order -> PUT /upload/order (per file) -> complete-order
//   -> order-wow-selection -> attach-special-media (cover/background)
//   -> order-notify-admin
// `requestId` makes create-order idempotent: retrying after a weak-network
// failure resumes the same order and skips files that already uploaded.
import { apiPost, ApiError, wait } from "../lib/api.js";

function uploadWithProgress(ticket, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", window.LAMSA_UPLOAD_URL("order-uploads", ticket.path, ticket.token));
    if (window.LAMSA_CONFIG?.SUPABASE_PUBLISHABLE_KEY && !String(window.LAMSA_CONFIG.SUPABASE_PUBLISHABLE_KEY).startsWith("__")) xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", blob.type);
    xhr.timeout = 10 * 60 * 1000;
    xhr.upload.onprogress = e => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `تعذر رفع الملف (${xhr.status})`; try { msg = JSON.parse(xhr.responseText).error || msg; } catch {}
      reject(new ApiError(msg, { status: xhr.status }));
    };
    xhr.onerror = () => reject(new ApiError("انقطع الاتصال أثناء الرفع", { offline: true }));
    xhr.ontimeout = () => reject(new ApiError("الرفع أخد وقت طويل جدًا", { offline: true }));
    xhr.send(blob);
  });
}

async function uploadRetry(ticket, blob, onProgress, attempts = 4) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { await uploadWithProgress(ticket, blob, onProgress); return; }
    catch (e) {
      last = e; if (e.status && e.status < 500 && e.status !== 408 && e.status !== 429) throw e;
      if (!navigator.onLine) await new Promise(r => addEventListener("online", r, { once: true }));
      await wait(1000 * 2 ** i);
    }
  }
  throw last;
}

/**
 * @param {object} p
 * @param {object} p.payload create-order body
 * @param {Blob[]} p.files main files in clientIndex order
 * @param {{kind:string,blob:Blob,name:string}[]} p.special cover/background
 * @param {object[]} p.games order-wow-selection games payload
 * @param {(e:{phase:string,ratio:number,label:string,file?:number})=>void} p.onProgress
 */
export async function submitOrder({ payload, files, special, games, onProgress }) {
  const report = (phase, ratio, label, file) => onProgress?.({ phase, ratio, label, file });
  report("create", 0.04, "جاري إنشاء الطلب…");
  const result = await apiPost("create-order", payload, { retries: 2, timeoutMs: 45_000 });
  const total = Math.max(1, result.uploads.length);
  for (let i = 0; i < result.uploads.length; i++) {
    const t = result.uploads[i], blob = files[Number(t.clientIndex)];
    if (!blob) throw new ApiError("حصل خطأ في مطابقة أحد الملفات. ابدأ الإرسال من جديد.");
    if (t.alreadyUploaded) { report("upload", 0.1 + 0.72 * ((i + 1) / total), `الملف ${i + 1} من ${total} مرفوع بالفعل`, i); continue; }
    await uploadRetry(t, blob, r => report("upload", 0.1 + 0.72 * ((i + r) / total), `رفع الملف ${i + 1} من ${total} — ${Math.round(r * 100)}%`, i));
    report("upload", 0.1 + 0.72 * ((i + 1) / total), `تم رفع الملف ${i + 1} من ${total}`, i);
  }
  report("complete", 0.85, "التأكد من الملفات وتأكيد الطلب…");
  const auth = { orderNumber: result.orderNumber, trackingToken: result.trackingToken };
  const completed = await apiPost("complete-order", auth, { retries: 2 });
  const warnings = [];
  report("games", 0.9, "حفظ الألعاب والإجابات…");
  try { await apiPost("order-wow-selection", { ...auth, games }, { retries: 2 }); }
  catch (e) { warnings.push(`الألعاب: ${e.message}. فريق لمسة هيراجعها معاك.`); }
  if (special.length) {
    report("special", 0.94, "رفع صورة الغلاف والخلفية…");
    try {
      const prep = await apiPost("attach-special-media", { ...auth, stage: "prepare", files: special.map(x => ({ kind: x.kind, name: x.name, mimeType: x.blob.type, size: x.blob.size })) }, { retries: 1 });
      for (const t of prep.uploads || []) { const item = special.find(x => x.kind === t.kind); if (item) await uploadRetry(t, item.blob); }
      await apiPost("attach-special-media", { ...auth, stage: "finalize" }, { retries: 1 });
    } catch (e) { warnings.push(`صورة الغلاف/الخلفية: ${e.message}`); }
  }
  try { await apiPost("order-notify-admin", auth); } catch {}
  report("done", 1, "تم إرسال الطلب بنجاح ♡");
  return { ...result, whatsappStatus: completed?.whatsappStatus || "", warnings };
}

export async function abortOrder(auth) { try { await apiPost("abort-order", auth); } catch {} }
