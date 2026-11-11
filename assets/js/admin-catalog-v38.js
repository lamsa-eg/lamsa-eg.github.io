// Admin catalog: packages/prices, add-ons, occasion packs, seasons, games, audit.
// Writes go straight to Supabase with the admin's session; RLS (migration v38)
// allows only owner/admin, and every change is written to admin_audit_logs.
import { toast, escapeHtml as esc } from "./common-cf-v4.js";
import { db, requireAdmin } from "./client-cf-v4.js";
import { GAMES } from "./games/registry.js";

let ctx = null, tab = "packages";
const panel = document.getElementById("panel");
const num = v => { const s = String(v ?? "").trim(); if (s === "") return null; const n = Number(s); return Number.isFinite(n) && n >= 0 ? n : NaN; };
const MB = 1048576;

const TABS = {
  async packages(s) {
    let { data, error } = await s.from("packages").select("*").order("sort_order");
    if (error) throw error;
    const v38 = data.length && "max_games" in data[0];
    return `${v38 ? "" : `<p class="cat-warn">شغّل migration v38 لتفعيل حقول «عدد الألعاب» و«ننصح بها» والمميزات.</p>`}
    <div class="cat-list">${data.map(p => `<form class="cat-row" data-table="packages" data-id="${esc(p.id)}">
      <h3>${esc(p.id)}</h3>
      <label class="field">الاسم<input name="label" maxlength="40" value="${esc(p.label)}" required></label>
      <label class="field">السعر (ج.م)<input name="price" type="number" min="0" step="1" value="${esc(p.price)}" required></label>
      <label class="field">عدد الصور<input name="max_images" type="number" min="1" max="30" value="${esc(p.max_images ?? "")}"></label>
      <label class="field">أقصى حجم للصورة MB<input name="max_image_bytes" data-mb type="number" min="1" max="20" value="${p.max_image_bytes ? Math.round(p.max_image_bytes / MB) : ""}"></label>
      ${v38 ? `<label class="field">عدد الألعاب المضمنة<input name="max_games" type="number" min="0" max="3" value="${esc(p.max_games ?? "")}"></label>
      <label class="field">جملة قصيرة (لمن تناسب)<input name="tagline" maxlength="80" value="${esc(p.tagline || "")}"></label>
      <label class="field cat-wide">المميزات (سطر لكل ميزة — فارغ = تلقائي من الحدود)<textarea name="features" rows="3">${esc((p.features || []).join("\n"))}</textarea></label>
      <label class="cat-check"><input type="checkbox" name="is_recommended" ${p.is_recommended ? "checked" : ""}> ننصح بها (تظهر مميزة)</label>` : ""}
      <label class="cat-check"><input type="checkbox" name="allow_song" ${p.allow_song ? "checked" : ""}> أغنية</label>
      <label class="cat-check"><input type="checkbox" name="allow_video" ${p.allow_video ? "checked" : ""}> فيديو</label>
      <label class="cat-check"><input type="checkbox" name="allow_audio" ${p.allow_audio ? "checked" : ""}> رسالة صوتية</label>
      <label class="cat-check"><input type="checkbox" name="active" ${p.active !== false ? "checked" : ""}> مفعلة</label>
      <button class="btn" type="submit">حفظ</button></form>`).join("")}</div>`;
  },
  async addons(s) {
    const { data, error } = await s.from("wow_addons").select("*").order("sort_order"); if (error) throw error;
    return `<p class="cat-note">الإضافات اللي ليها سعر ومفعلة بس هي اللي تظهر للعميل في الطلب (مثل «لعبة إضافية» و«ستيكرات صيد الكنز»).</p><div class="cat-list">${data.map(a => `<form class="cat-row" data-table="wow_addons" data-id="${esc(a.id)}"><h3>${esc(a.id)}</h3>
      <label class="field">الاسم<input name="label" maxlength="60" value="${esc(a.label)}" required></label>
      <label class="field">السعر (ج.م) — فارغ = غير معروض<input name="price" type="number" min="0" step="1" value="${a.price ?? ""}"></label>
      <label class="cat-check"><input type="checkbox" name="active" ${a.active ? "checked" : ""}> مفعلة</label><button class="btn" type="submit">حفظ</button></form>`).join("")}</div>`;
  },
  async packs(s) {
    const { data, error } = await s.from("wow_packs").select("*").order("sort_order"); if (error) throw error;
    return `<div class="cat-list">${data.map(a => `<form class="cat-row" data-table="wow_packs" data-id="${esc(a.id)}"><h3>${esc(a.id)}</h3>
      <label class="field">الاسم<input name="label" maxlength="60" value="${esc(a.label)}" required></label>
      <label class="field">السعر (ج.م)<input name="price" type="number" min="0" step="1" value="${a.price ?? ""}"></label>
      <label class="cat-check"><input type="checkbox" name="active" ${a.active ? "checked" : ""}> مفعلة</label><button class="btn" type="submit">حفظ</button></form>`).join("")}</div>`;
  },
  async seasons(s) {
    const { data, error } = await s.from("seasons").select("*").order("starts_on", { ascending: false }); if (error) throw error;
    const row = x => `<form class="cat-row" data-table="seasons" data-id="${esc(x?.id || "")}">${x ? `<h3>${esc(x.id)}</h3>` : `<h3>موسم جديد</h3><label class="field">المعرف (إنجليزي)<input name="id" pattern="[a-z0-9-]{3,40}" required></label>`}
      <label class="field">الاسم<input name="name" maxlength="60" value="${esc(x?.name || "")}" required></label>
      <label class="field cat-wide">نص البانر<input name="banner_text" maxlength="160" value="${esc(x?.banner_text || "")}"></label>
      <label class="field">من<input type="date" name="starts_on" value="${esc(x?.starts_on || "")}" required></label>
      <label class="field">إلى<input type="date" name="ends_on" value="${esc(x?.ends_on || "")}" required></label>
      <label class="field">آخر موعد طلب مضمون<input type="datetime-local" name="order_cutoff" value="${x?.order_cutoff ? esc(x.order_cutoff.slice(0, 16)) : ""}"></label>
      <label class="cat-check"><input type="checkbox" name="active" ${x?.active !== false ? "checked" : ""}> مفعل</label><button class="btn" type="submit">${x ? "حفظ" : "إضافة"}</button></form>`;
    return `<div class="cat-list">${row(null)}${data.map(row).join("")}</div>`;
  },
  async games(s) {
    const { data, error } = await s.from("game_catalog").select("*").order("sort_order");
    if (error) return `<p class="cat-warn">جدول الألعاب غير موجود — شغّل migration v38. (${esc(error.message)})</p>`;
    const { data: pk } = await s.from("packages").select("id,label").order("sort_order");
    const known = new Map(GAMES.map(g => [g.key, g]));
    return `<p class="cat-note">إيقاف لعبة يخفيها من صفحة الطلب للطلبات الجديدة فقط. الأسئلة والإجابات نفسها يكتبها العميل وتتعدل من «تحرير الذكرى».</p><div class="cat-list">${data.map(g => `<form class="cat-row" data-table="game_catalog" data-key="${esc(g.key)}"><h3>${esc(known.get(g.key)?.icon || "✦")} ${esc(g.key)}</h3>
      <label class="field">الاسم الظاهر<input name="label" maxlength="80" value="${esc(g.label)}" required></label>
      <label class="field cat-wide">وصف قصير<input name="description" maxlength="240" value="${esc(g.description || "")}" placeholder="${esc(known.get(g.key)?.short || "")}"></label>
      <label class="field">الترتيب<input name="sort_order" type="number" value="${esc(g.sort_order)}"></label>
      <label class="field">متاحة من باقة<select name="min_package"><option value="">كل الباقات</option>${(pk || []).map(p => `<option value="${esc(p.id)}" ${g.min_package === p.id ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select></label>
      <label class="cat-check"><input type="checkbox" name="active" ${g.active ? "checked" : ""}> متاحة للبيع</label><button class="btn" type="submit">حفظ</button></form>`).join("")}</div>`;
  },
  async payments(s) {
    const { data, error } = await s.from("site_settings").select("key,value").in("key", ["instapay", "meta_pixel"]);
    if (error) return `<p class="cat-warn">إعدادات الدفع غير متاحة (${esc(error.message)})</p>`;
    const get = k => (data || []).find(r => r.key === k)?.value || {};
    const v = get("instapay"), px = get("meta_pixel");
    return `<p class="cat-note">إنستاباي هو طريقة الدفع الوحيدة. البيانات دي بتظهر للعميل في صفحة نجاح الطلب مع المبلغ وزرار الدفع.</p>
    <div class="cat-list"><form class="cat-row" data-table="site_settings" data-key="instapay"><h3>⚡ إنستاباي</h3>
      <label class="field">الاسم اللي يظهر للعميل<input name="name" maxlength="40" value="${esc(v.name || "Lamsa")}" placeholder="Lamsa"></label>
      <label class="field">عنوان الدفع (IPA)<input name="ipa" dir="ltr" required pattern="[A-Za-z0-9._-]+@instapay" value="${esc(v.ipa || "")}" placeholder="name@instapay"></label>
      <label class="field cat-wide">رابط الدفع (يبدأ بـ https://ipn.eg/)<input name="link" dir="ltr" type="url" pattern="https://ipn\.eg/.+" value="${esc(v.link || "")}"></label>
      <button class="btn" type="submit">حفظ</button></form>
    <form class="cat-row" data-table="site_settings" data-key="meta_pixel"><h3>📣 فيسبوك / ميتا بكسل</h3>
      <p class="cat-note cat-wide">من Events Manager ← Data sources ← انسخ رقم الـ Pixel (أرقام بس). سيبه فاضي لإيقاف التتبع.</p>
      <label class="field">Pixel ID<input name="id" dir="ltr" inputmode="numeric" pattern="[0-9]{8,20}" value="${esc(px.id || "")}" placeholder="123456789012345"></label>
      <button class="btn" type="submit">حفظ</button></form></div>`;
  },
  async audit(s) {
    const { data, error } = await s.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(150);
    if (error) return `<p class="cat-warn">سجل التعديلات غير متاح — شغّل migration v38. (${esc(error.message)})</p>`;
    if (!data.length) return `<p class="muted">لا توجد تعديلات مسجلة بعد.</p>`;
    return `<div class="cat-audit"><table><thead><tr><th>الوقت</th><th>الجدول</th><th>العنصر</th><th>العملية</th><th>بواسطة</th><th>التغييرات</th></tr></thead><tbody>${data.map(r => `<tr><td>${new Date(r.created_at).toLocaleString("ar-EG")}</td><td>${esc(r.table_name)}</td><td>${esc(r.row_id || "")}</td><td>${esc(r.action)}</td><td>${esc(r.actor_role || "")}</td><td><code>${esc(Object.entries(r.changes || {}).map(([k, v]) => `${k}: ${JSON.stringify(v?.from)} → ${JSON.stringify(v?.to)}`).join(" · ")).slice(0, 400)}</code></td></tr>`).join("")}</tbody></table></div>`;
  }
};

function collect(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === "checkbox") out[el.name] = el.checked;
    else if (el.type === "number") { const n = num(el.value); if (Number.isNaN(n)) throw new Error(`قيمة غير صالحة: ${el.closest("label")?.firstChild?.textContent || el.name}`); out[el.name] = el.dataset.mb !== undefined && n !== null ? Math.round(n * MB) : n; }
    else if (el.name === "features") out.features = el.value.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 8);
    else if (el.type === "datetime-local") out[el.name] = el.value ? new Date(el.value).toISOString() : null;
    else out[el.name] = el.value.trim() || (["description", "tagline", "banner_text", "min_package"].includes(el.name) ? null : el.value.trim());
  }
  return out;
}

async function save(form) {
  const s = db(), table = form.dataset.table; let values;
  try { values = collect(form); } catch (e) { toast(e.message); return; }
  if (table === "packages" && (values.price === null || values.price === undefined)) return toast("السعر مطلوب");
  const btn = form.querySelector("button[type=submit]"); btn.disabled = true;
  try {
    let q;
    if (table === "game_catalog") q = s.from(table).update({ ...values, updated_at: new Date().toISOString() }).eq("key", form.dataset.key);
    else if (table === "site_settings") q = s.from(table).upsert({ key: form.dataset.key, value: values, is_public: true, updated_at: new Date().toISOString() }, { onConflict: "key" });
    else if (table === "seasons" && !form.dataset.id) q = s.from(table).insert(values);
    else q = s.from(table).update(table === "packages" || table === "seasons" ? { ...values, updated_at: new Date().toISOString() } : values).eq("id", form.dataset.id);
    const { data, error } = await q.select();
    if (error) throw error;
    if (!data?.length) throw new Error("لم يتم الحفظ — صلاحياتك لا تسمح بتعديل الكتالوج (مطلوب owner أو admin).");
    toast("تم الحفظ ✓ — يظهر في الموقع خلال دقيقة");
    if (table === "seasons" && !form.dataset.id) render();
  } catch (e) { toast(e.message || "تعذر الحفظ"); } finally { btn.disabled = false; }
}

async function render() {
  panel.innerHTML = `<div class="muted">تحميل…</div>`;
  try { panel.innerHTML = await TABS[tab](db()); } catch (e) { panel.innerHTML = `<p class="cat-warn">تعذر التحميل: ${esc(e.message || e)}</p>`; }
}
document.querySelector(".cat-tabs").addEventListener("click", e => {
  const b = e.target.closest("[data-tab]"); if (!b) return; tab = b.dataset.tab;
  document.querySelectorAll(".cat-tabs [data-tab]").forEach(x => x.setAttribute("aria-selected", String(x === b))); render();
});
panel.addEventListener("submit", e => { e.preventDefault(); save(e.target); });
document.getElementById("refresh").onclick = render;
(async () => {
  ctx = await requireAdmin(); if (!ctx) return;
  if (!["owner", "admin"].includes(ctx.profile.role)) { const n = document.getElementById("roleNote"); n.hidden = false; n.textContent = "حسابك «محرر»: تقدر تشوف الكتالوج لكن التعديل متاح للمالك أو المدير فقط."; }
  render();
})();
