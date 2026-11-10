import { apiPost } from "./lib/api.js";
import { money } from "./lib/catalog.js";
import { toast } from "./lib/ui.js";
const $ = id => document.getElementById(id), qs = new URLSearchParams(location.search);
const legacy = qs.get("token") || "";
if (legacy) { sessionStorage.setItem("lamsa_track_token", legacy); const u = new URL(location.href); u.searchParams.delete("token"); history.replaceState(null, "", u.pathname + u.search); }
const order = qs.get("order") || sessionStorage.getItem("lamsa_track_order") || "", token = legacy || sessionStorage.getItem("lamsa_track_token") || "";
$("orderNo").textContent = order || "—";
$("trackingCode").textContent = token || "الرمز غير متاح على الجهاز ده";
$("trackBtn").href = `/track.html?order=${encodeURIComponent(order)}`;
const warn = sessionStorage.getItem("lamsa_special_media_warning");
if (warn) { $("warn").hidden = false; $("warn").textContent = `ملاحظة: ${warn}`; }
$("copyTracking").disabled = !token || !order;
$("copyTracking").onclick = async () => { try { await navigator.clipboard.writeText(`LAMSA\nرقم الطلب: ${order}\nرمز المتابعة: ${token}`); toast("اتنسخت بيانات المتابعة ✓"); } catch { toast("اضغط مطولًا على الرمز عشان تنسخه"); } };
if (order && token) {
  try {
    const d = await apiPost("track-order", { orderNumber: order, trackingToken: token }, { retries: 1 });
    const wow = Number(d.wowPrice ?? sessionStorage.getItem("lamsa_wow_price") ?? 0);
    if (Number.isFinite(Number(d.price))) $("basePrice").textContent = money(d.price);
    $("wowPrice").textContent = wow ? money(wow) : "ضمن الباقة";
    $("shippingPrice").textContent = d.shippingPending ? "يتحدد بعد التأكيد" : (d.shippingFee !== undefined ? money(d.shippingFee) : "—");
    if (d.totalAmount !== undefined) $("totalPrice").textContent = d.shippingPending ? `${money(d.totalAmount)} + الشحن` : money(d.totalAmount);
    if (d.whatsappStatus === "sent") $("waStatus").hidden = false;
  } catch { $("pricing").hidden = true; }
} else $("pricing").hidden = true;
