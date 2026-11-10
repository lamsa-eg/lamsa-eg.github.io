// Marks an order complete once every customer file is really in storage.
import { admin, clean, cors, out } from "../_shared/wow.ts";
import { event, orderByToken, storedNames } from "../_shared/orders.ts";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const order = await orderByToken(clean(body.orderNumber, 50), clean(body.trackingToken, 200), "id,order_number,submission_state,whatsapp_status");
    if (!order) return out({ error: "بيانات الطلب غير صحيحة" }, 401);
    if (order.submission_state === "aborted") return out({ error: "الطلب ده اتلغى. ابدأ طلب جديد." }, 409);
    if (order.submission_state === "complete") return out({ ok: true, whatsappStatus: order.whatsapp_status, already: true });
    const { data: rows, error } = await admin.from("order_uploads").select("id,storage_path,kind").eq("order_id", order.id).not("client_index", "is", null);
    if (error) throw error;
    const stored = await storedNames(order.id);
    const missing = (rows || []).filter((r: any) => !stored.has(r.storage_path));
    if (missing.length) return out({ error: `فيه ${missing.length} ملف لسه ما اترفعش. اضغط إعادة المحاولة.`, missing: missing.length }, 409);
    if (!(rows || []).some((r: any) => r.kind === "image")) return out({ error: "لازم صورة واحدة على الأقل" }, 400);
    const now = new Date().toISOString();
    await admin.from("order_uploads").update({ uploaded_at: now }).eq("order_id", order.id).is("uploaded_at", null);
    const { error: uErr } = await admin.from("orders").update({ submission_state: "complete", submitted_at: now }).eq("id", order.id).eq("submission_state", "uploading");
    if (uErr) throw uErr;
    await event(order.id, "order_completed", { files: rows?.length || 0 });
    return out({ ok: true, whatsappStatus: order.whatsapp_status });
  } catch (e) { console.error(e); return out({ error: "تعذر تأكيد الطلب. حاول مرة أخرى." }, 500); }
});
