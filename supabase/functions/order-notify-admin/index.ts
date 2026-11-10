// Tells the team a new order arrived (in-panel notification + optional web push).
import { clean, cors, out } from "../_shared/wow.ts";
import { notifyAdmins, orderByToken } from "../_shared/orders.ts";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const o = await orderByToken(clean(body.orderNumber, 50), clean(body.trackingToken, 200), "id,order_number,submission_state,sender_name,recipient_name,package_id,total_amount");
    if (!o || o.submission_state !== "complete") return out({ error: "بيانات الطلب غير صحيحة" }, 401);
    const r = await notifyAdmins({ eventKey: `order:${o.id}:new`, title: `طلب جديد ${o.order_number}`, body: `من ${o.sender_name} إلى ${o.recipient_name} · ${o.package_id} · ${Number(o.total_amount)} ج.م`, href: `/admin/order-detail.html?id=${o.id}`, severity: "success" });
    return out({ ok: true, ...r });
  } catch (e) { console.error(e); return out({ error: "تعذر إرسال الإشعار" }, 500); }
});
