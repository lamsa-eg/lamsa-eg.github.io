// InstaPay payment box: amount, pay link, IPA + order reference copy, receipt upload.
// Payment details come from /public-config (site_settings) — nothing hardcoded.
import { apiPost, loadPublicConfig } from "./lib/api.js";
import { money } from "./lib/catalog.js";
import { toast } from "./lib/ui.js";
import { optimizeImageFile } from "./image-optimize-v26.js";
import { track as px } from "./lib/marketing.js";

const $ = id => document.getElementById(id);

async function copy(text, label) {
  try { await navigator.clipboard.writeText(text); toast(`اتنسخ ${label} ✓`); } catch { toast("اضغط مطولًا عشان تنسخ"); }
}

function setProofState(state) {
  const box = $("proofBox"), status = $("proofStatus"), btn = $("proofBtn");
  box.classList.toggle("is-done", state === "uploaded" || state === "paid");
  if (state === "paid") { status.textContent = "✓ تم تأكيد الدفع. شكرًا ♡"; btn.hidden = true; }
  else if (state === "uploaded") { status.textContent = "✓ الإيصال وصلنا، هنأكد الدفع ونبلغك على واتساب."; btn.textContent = "تغيير صورة الإيصال"; }
}

function uploadPut(url, blob) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest(); x.open("PUT", url); x.setRequestHeader("Content-Type", blob.type); x.setRequestHeader("x-upsert", "false");
    if (window.LAMSA_API_HEADERS) for (const [k, v] of Object.entries(window.LAMSA_API_HEADERS({}))) x.setRequestHeader(k, v);
    x.upload.onprogress = e => e.lengthComputable && ($("proofStatus").textContent = `جاري الرفع… ${Math.round((e.loaded / e.total) * 100)}%`);
    x.onload = () => (x.status < 300 ? resolve() : reject(new Error("تعذر رفع الإيصال")));
    x.onerror = () => reject(new Error("انقطع الاتصال أثناء الرفع"));
    x.send(blob);
  });
}

/** Mounts the box. `track` is the track-order response. */
export async function mountInstapay({ order, token, track }) {
  const box = $("payBox"); if (!box || !order || !token || !track) return;
  if (track.paymentMethod && track.paymentMethod !== "instapay") return;
  let ip = null;
  try { ip = (await loadPublicConfig()).payments?.instapay || null; } catch {}
  box.hidden = false;
  $("payAmount").textContent = money(track.totalAmount);
  $("payShipNote").hidden = !track.shippingPending;
  $("payRef").textContent = order;
  if (ip?.link) { $("payLink").href = ip.link; $("payLink").hidden = false; }
  if ($("payName")) $("payName").textContent = ip?.name || "Lamsa";
  $("payIpa").textContent = ip?.ipa || "هنبعتلك بيانات الدفع على واتساب";
  $("copyIpa").hidden = !ip?.ipa;
  $("copyIpa").onclick = () => copy(ip.ipa, "عنوان إنستاباي");
  $("copyRef").onclick = () => copy(order, "رقم الطلب");
  if (track.paymentStatus === "paid") return setProofState("paid");
  if (track.paymentProofUploaded) setProofState("uploaded");
  $("proofInput").onchange = async e => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    const btn = $("proofBtn"); btn.setAttribute("aria-disabled", "true");
    try {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("ارفع صورة (JPG أو PNG)");
      $("proofStatus").textContent = "جاري تجهيز الصورة…";
      const blob = (await optimizeImageFile(file, 5 * 1048576, { maxDimension: 2200 })).file;
      const t = await apiPost("payment-proof", { orderNumber: order, trackingToken: token, stage: "prepare", mimeType: blob.type, size: blob.size });
      await uploadPut(window.LAMSA_UPLOAD_URL("order-uploads", t.path, t.token), blob);
      await apiPost("payment-proof", { orderNumber: order, trackingToken: token, stage: "finalize" });
      setProofState("uploaded"); toast("الإيصال وصل ✓"); px("AddPaymentInfo", { currency: "EGP", value: Number(track.totalAmount) || 0 }, { once: `proof_${order}` });
    } catch (err) { $("proofStatus").textContent = err.message || "تعذر رفع الإيصال، جرّب تاني"; }
    finally { btn.removeAttribute("aria-disabled"); }
  };
}
