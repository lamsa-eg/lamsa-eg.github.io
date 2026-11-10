// InstaPay transfer receipt: the customer uploads a screenshot after paying.
// stage=prepare -> one-time signed upload URL; stage=finalize -> verify, attach, notify staff.
import { admin, clean, cors, out, rateAllowed, trustedIp } from "../_shared/wow.ts";
import { ORDER_BUCKET, event, notifyAdmins, orderByToken, storedNames } from "../_shared/orders.ts";

const MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX = 6 * 1048576;

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ error: "Method not allowed" }, 405);
  try {
    if (!(await rateAllowed("payment-proof", trustedIp(req), 20, 3600))) return out({ error: "محاولات كثيرة" }, 429);
    const body = await req.json();
    const o = await orderByToken(clean(body.orderNumber, 50), clean(body.trackingToken, 200), "id,order_number,submission_state,payment_status,total_amount,sender_name");
    if (!o || o.submission_state !== "complete") return out({ error: "بيانات الطلب غير صحيحة" }, 401);
    if (o.payment_status === "paid") return out({ error: "الطلب ده مدفوع بالفعل ♡" }, 409);
    if (body.stage === "prepare") {
      const mime = clean(body.mimeType, 40).toLowerCase(), size = Number(body.size || 0);
      if (!MIME.has(mime) || size <= 0 || size > MAX) return out({ error: "الإيصال لازم يكون صورة (JPG أو PNG) أقل من 6MB" }, 400);
      const { data: old } = await admin.from("order_uploads").select("id,storage_path").eq("order_id", o.id).eq("kind", "payment_proof");
      if (old?.length) { await admin.storage.from(ORDER_BUCKET).remove(old.map((x: any) => x.storage_path)); await admin.from("order_uploads").delete().in("id", old.map((x: any) => x.id)); }
      const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      const path = `${o.id}/${crypto.randomUUID()}-instapay-receipt.${ext}`;
      const { data: signed, error } = await admin.storage.from(ORDER_BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      const { error: iErr } = await admin.from("order_uploads").insert({ order_id: o.id, client_index: null, kind: "payment_proof", storage_path: path, original_name: `instapay-receipt.${ext}`, mime_type: mime, bytes: size });
      if (iErr) throw iErr;
      return out({ path, token: signed.token });
    }
    if (body.stage === "finalize") {
      const { data: row } = await admin.from("order_uploads").select("id,storage_path").eq("order_id", o.id).eq("kind", "payment_proof").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!row || !(await storedNames(o.id)).has(row.storage_path)) return out({ error: "الإيصال ما اترفعش. جرّب تاني." }, 409);
      const now = new Date().toISOString();
      await admin.from("order_uploads").update({ uploaded_at: now }).eq("id", row.id);
      const { error } = await admin.from("orders").update({ payment_proof_path: row.storage_path, payment_proof_uploaded_at: now }).eq("id", o.id);
      if (error) throw error;
      await event(o.id, "payment_proof_uploaded", { method: "instapay" });
      await notifyAdmins({ eventKey: `order:${o.id}:receipt:${now}`, title: `إيصال إنستاباي — ${o.order_number}`, body: `${o.sender_name} رفع إيصال تحويل بمبلغ ${Number(o.total_amount)} ج.م. راجعه وأكّد الدفع.`, href: `/admin/order-detail.html?id=${o.id}`, severity: "warning" });
      return out({ ok: true });
    }
    return out({ error: "stage غير معروف" }, 400);
  } catch (e) { console.error(e); return out({ error: "تعذر رفع الإيصال" }, 500); }
});
