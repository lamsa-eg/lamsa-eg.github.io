// Deletes an unfinished order and its uploaded files. Completed orders are never deleted here.
import { admin, clean, cors, out } from "../_shared/wow.ts";
import { ORDER_BUCKET, orderByToken } from "../_shared/orders.ts";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const order = await orderByToken(clean(body.orderNumber, 50), clean(body.trackingToken, 200), "id,submission_state");
    if (!order) return out({ ok: true });
    if (order.submission_state === "complete") return out({ error: "الطلب اتأكد بالفعل ومينفعش يتلغي من هنا. كلمنا على واتساب." }, 409);
    const { data: files } = await admin.storage.from(ORDER_BUCKET).list(order.id, { limit: 200 });
    const paths = (files || []).map((f: any) => `${order.id}/${f.name}`);
    if (paths.length) await admin.storage.from(ORDER_BUCKET).remove(paths);
    const { error } = await admin.from("orders").delete().eq("id", order.id).neq("submission_state", "complete");
    if (error) throw error;
    return out({ ok: true });
  } catch (e) { console.error(e); return out({ error: "تعذر إلغاء الطلب" }, 500); }
});
