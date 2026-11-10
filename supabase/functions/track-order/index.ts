// Order status for the customer (order number + private tracking token). Rate limited.
import { admin, clean, cors, gatewayOk, out, rateAllowed, trustedIp } from "../_shared/wow.ts";
import { money, orderByToken } from "../_shared/orders.ts";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ error: "Method not allowed" }, 405);
  try {
    const ip = (await gatewayOk(req)) ? trustedIp(req) : (req.headers.get("cf-connecting-ip") || "unknown");
    if (!(await rateAllowed("track-order", ip, 30, 600))) return out({ error: "محاولات كثيرة. حاول بعد شوية." }, 429);
    const body = await req.json();
    const o = await orderByToken(clean(body.orderNumber, 50), clean(body.trackingToken, 200),
      "id,order_number,status,payment_status,payment_method,payment_proof_uploaded_at,submission_state,package_id,price,shipping_fee,shipping_pending,total_amount,wow_price,requested_delivery_date,whatsapp_status,created_at,submitted_at,packages(label)");
    if (!o) return out({ error: "رقم الطلب أو رمز المتابعة غير صحيح" }, 404);
    const pkg = Array.isArray(o.packages) ? o.packages[0] : o.packages;
    return out({
      orderNumber: o.order_number, status: o.status, paymentStatus: o.payment_status, paymentMethod: o.payment_method, paymentProofUploaded: !!o.payment_proof_uploaded_at, submissionState: o.submission_state,
      package: pkg?.label || o.package_id, price: money(o.price), wowPrice: money(o.wow_price), shippingFee: money(o.shipping_fee),
      shippingPending: o.shipping_pending === true, totalAmount: money(o.total_amount), requestedDeliveryDate: o.requested_delivery_date,
      whatsappStatus: o.whatsapp_status, createdAt: o.created_at, submittedAt: o.submitted_at
    });
  } catch (e) { console.error(e); return out({ error: "تعذر تحميل الطلب" }, 500); }
});
