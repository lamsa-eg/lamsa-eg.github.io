// Admin home: what needs attention right now.
import { db, requireAdmin } from "./client-cf-v4.js";
const ctx = await requireAdmin();
if (ctx) {
  document.getElementById("hello").textContent = `أهلًا ${ctx.profile.display_name || ""} — ده اللي محتاج منك حاجة دلوقتي:`;
  const { data } = await db().from("orders").select("status,payment_status,payment_proof_uploaded_at,submission_state,admin_hidden_at").is("admin_hidden_at", null).limit(500);
  const o = (data || []).filter(x => x.submission_state === "complete" && x.status !== "cancelled");
  const cards = [
    ["إيصالات مستنية مراجعة", o.filter(x => x.payment_status !== "paid" && x.payment_proof_uploaded_at).length],
    ["طلبات مستنية الدفع", o.filter(x => x.payment_status === "pending" && !x.payment_proof_uploaded_at).length],
    ["مدفوعة ومحتاجة تجهيز", o.filter(x => x.payment_status === "paid" && x.status === "pending").length],
    ["بتتجهّز / في الشحن", o.filter(x => ["processing", "shipped"].includes(x.status)).length]
  ];
  const box = document.getElementById("todo"); box.hidden = false;
  box.innerHTML = cards.map(([l, n], i) => `<a class="card stat${n && i !== 1 && i !== 3 ? " has" : ""}" href="dashboard.html"><small>${l}</small><b>${n}</b></a>`).join("");
}
