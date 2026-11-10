// Staff updates order status / payment status. Requires an admin session (JWT).
import { actor, admin, clean, cors, out } from "../_shared/wow.ts";
import { event } from "../_shared/orders.ts";

const STATUS = new Set(["pending", "processing", "shipped", "delivered", "cancelled"]);
const PAYMENT = new Set(["pending", "paid", "failed", "refunded"]);

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ error: "Method not allowed" }, 405);
  try {
    const who = await actor(req); if (!who) return out({ error: "غير مصرح" }, 401);
    const body = await req.json(), id = clean(body.orderId, 40), status = clean(body.status, 20), paymentStatus = clean(body.paymentStatus, 20);
    if (!/^[0-9a-f-]{36}$/i.test(id) || !STATUS.has(status) || !PAYMENT.has(paymentStatus)) return out({ error: "بيانات غير صالحة" }, 400);
    const { data: before, error: bErr } = await admin.from("orders").select("status,payment_status").eq("id", id).maybeSingle();
    if (bErr) throw bErr; if (!before) return out({ error: "الطلب غير موجود" }, 404);
    const { error } = await admin.from("orders").update({ status, payment_status: paymentStatus }).eq("id", id);
    if (error) throw error;
    await event(id, "status_changed", { by: who.user.id, role: who.profile.role, from: before, to: { status, payment_status: paymentStatus } });
    // WhatsApp Business API is not connected yet; the team contacts the customer manually.
    return out({ ok: true, status, paymentStatus, customerWhatsAppStatus: "skipped" });
  } catch (e) { console.error(e); return out({ error: "تعذر حفظ الحالة" }, 500); }
});
