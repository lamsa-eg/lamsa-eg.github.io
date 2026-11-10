// Homepage: live catalog (prices from DB only) + playable WOW demos.
import { loadPublicConfig } from "./lib/api.js";
import { buildCatalog, money, packageFeatures } from "./lib/catalog.js";
import { esc, $, $$, reveal } from "./lib/ui.js";

reveal();

/* ---------- packages ---------- */
async function packages() {
  const host = $("#packages-list"), status = $("#pkgStatus"), sticky = $("[data-min-price]");
  try {
    const cfg = await loadPublicConfig(), C = buildCatalog(cfg);
    if (!C.packages.length) throw new Error("empty");
    host.innerHTML = C.packages.map((p, i) => `<article class="h-pkg ${p.recommended ? "is-rec" : ""}">
      ${p.recommended ? '<span class="h-pkg-badge">ننصح بها</span>' : ""}
      <span class="h-pkg-no">0${i + 1}</span><h3>${esc(p.label)}</h3>
      ${p.tagline ? `<p class="h-pkg-for">${esc(p.tagline)}</p>` : ""}
      <p class="h-pkg-price">${money(p.price)}</p>
      <ul>${packageFeatures(p).map(f => `<li>${esc(f)}</li>`).join("")}</ul>
      <a class="l-btn ${p.recommended ? "l-btn-primary" : "l-btn-ghost"} l-btn-block" href="/order?package=${encodeURIComponent(p.id)}" data-cta="pkg-${esc(p.id)}">ابدأ بباقة ${esc(p.label)}</a>
    </article>`).join("");
    host.removeAttribute("aria-busy");
    const min = C.minPrice();
    if (sticky) { sticky.classList.remove("l-skel"); sticky.textContent = min === null ? "اختار باقتك" : money(min); }
    if (C.season) {
      const b = $("[data-season]"), cutoff = C.season.order_cutoff ? new Date(C.season.order_cutoff).toLocaleDateString("ar-EG", { day: "numeric", month: "long" }) : "";
      b.textContent = `${C.season.banner_text || C.season.name}${cutoff ? ` — آخر طلب مضمون: ${cutoff}` : ""}`; b.hidden = false;
    }
  } catch {
    host.removeAttribute("aria-busy");
    host.innerHTML = `<div class="l-alert l-alert-info h-pkg-err">مقدرناش نحمّل الأسعار دلوقتي. <a href="/order">افتح صفحة الطلب</a> أو جرّب تحدّث الصفحة.</div>`;
    status.textContent = "";
    if (sticky) { sticky.classList.remove("l-skel"); sticky.textContent = "اختار باقتك"; }
  }
}
packages();

/* ---------- WOW lab (illustrative examples, clearly labelled) ---------- */
const DEMOS = {
  who: { label: "مين فينا؟", sub: "سؤال من تفاصيلكم", render(p) {
    const qs = [["مين اللي بيتأخر أكتر؟", 1, "ربع ساعة بالظبط 😄"], ["مين قال «بحبك» الأول؟", 0, "وفاكر اليوم كمان ♡"]]; let i = 0, score = 0;
    const draw = () => {
      if (i >= qs.length) { p.innerHTML = `<div class="d-win"><b>${score}/${qs.length}</b><p>المفاجأة اتفتحت ♡</p><small>في هديتك، المفاجأة دي رسالة أو صورة منك.</small><button type="button" class="d-again">العب تاني</button></div>`; p.querySelector(".d-again").onclick = () => { i = 0; score = 0; draw(); }; return; }
      const [q, a, c] = qs[i];
      p.innerHTML = `<small class="d-count">سؤال ${i + 1} من ${qs.length}</small><p class="d-q">${q}</p><div class="d-opts">${["أنا", "إنت", "إحنا الاتنين"].map((o, k) => `<button type="button" data-k="${k}">${o}</button>`).join("")}</div><p class="d-react" role="status"></p>`;
      p.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { if (p.dataset.lock) return; p.dataset.lock = 1; const ok = Number(b.dataset.k) === a; if (ok) score++; b.classList.add(ok ? "is-right" : "is-wrong"); p.querySelector(`[data-k="${a}"]`).classList.add("is-right"); p.querySelector(".d-react").textContent = (ok ? "صح ♡ " : "قريب… ") + c; setTimeout(() => { delete p.dataset.lock; i++; draw(); }, 1500); });
    }; draw();
  } },
  story: { label: "رتّب ذكرياتنا", sub: "أحداث بالترتيب الحقيقي", render(p) {
    const ev = ["أول رسالة", "أول خروجة", "الخطوبة", "أول سفرية"]; let order = [2, 0, 3, 1], pick = -1;
    const draw = () => {
      const done = order.every((v, i) => v === i);
      p.innerHTML = `<p class="d-q">${done ? "بالظبط كده بدأت الحكاية ♡" : "اضغط على حدثين عشان يبدّلوا مكانهم"}</p><ol class="d-order">${order.map((v, i) => `<li><button type="button" data-i="${i}" class="${pick === i ? "is-pick" : ""} ${done ? "is-right" : ""}"><i>${i + 1}</i>${ev[v]}</button></li>`).join("")}</ol>${done ? '<button type="button" class="d-again">رتّبها تاني</button>' : ""}`;
      p.querySelectorAll("[data-i]").forEach(b => b.onclick = () => { const i = Number(b.dataset.i); if (done) return; if (pick < 0) { pick = i; } else { [order[pick], order[i]] = [order[i], order[pick]]; pick = -1; } draw(); });
      p.querySelector(".d-again")?.addEventListener("click", () => { order = [2, 0, 3, 1]; draw(); });
    }; draw();
  } },
  open: { label: "افتحها عندما…", sub: "رسائل لوقتها", render(p) {
    const letters = [["لما أوحشك", "افتكر إن فيه حد بيعدّ الأيام لحد ما يشوفك."], ["لما تكون متضايق", "خد نفس… وكلمني. أنا هنا دايمًا."], ["في عيد ميلادك", "🔒 بتفتح في يومها بس"]];
    p.innerHTML = `<div class="d-letters">${letters.map(([t, m], i) => `<button type="button" aria-expanded="false" data-l="${i}"><b>${t}</b><span>ظرف مقفول</span></button>`).join("")}</div>`;
    p.querySelectorAll("[data-l]").forEach(b => b.onclick = () => { const [t, m] = letters[b.dataset.l]; const open = b.getAttribute("aria-expanded") === "true"; b.setAttribute("aria-expanded", String(!open)); b.innerHTML = open ? `<b>${t}</b><span>ظرف مقفول</span>` : `<b>${t}</b><p>${m}</p>`; });
  } },
  guess: { label: "خمّن إجابتي", sub: "إجابة واحدة صح", render(p) {
    p.innerHTML = `<p class="d-q">أكتر أكلة بحبها من إيدك؟</p><div class="d-opts">${["مكرونة بشاميل", "محشي", "كشري"].map((o, k) => `<button type="button" data-k="${k}">${o}</button>`).join("")}</div><p class="d-react" role="status"></p>`;
    p.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { const ok = b.dataset.k === "1"; p.querySelectorAll("[data-k]").forEach(x => x.disabled = true); b.classList.add(ok ? "is-right" : "is-wrong"); p.querySelector('[data-k="1"]').classList.add("is-right"); p.querySelector(".d-react").textContent = ok ? "صح ♡ ومستني الجاية من إيدك" : "لأ 😄 المحشي طبعًا!"; });
  } },
  wrapped: { label: "Love Wrapped", sub: "أرقام من شاتكم", render(p) {
    const cards = [["رسالة بينكم", "١٢٬٤٠٠"], ["أكتر إيموجي", "😂"], ["مين بيبدأ الكلام أكتر؟", "إنت ♡"]]; let i = 0;
    const draw = () => { const [l, v] = cards[i]; p.innerHTML = `<div class="d-wrapped"><small>${i + 1}/${cards.length}</small><strong>${v}</strong><span>${l}</span></div><button type="button" class="d-again">${i < cards.length - 1 ? "الكارت اللي بعده ←" : "من الأول"}</button><p class="d-react">مثال — الأرقام الحقيقية بتطلع من ملف شاتكم، والنص نفسه ما بيتحفظش.</p>`; p.querySelector(".d-again").onclick = () => { i = (i + 1) % cards.length; draw(); }; }; draw();
  } },
  touch: { label: "لمسة عن بُعد", sub: "في نفس اللحظة", render(p) {
    p.innerHTML = `<p class="d-q">اضغط على القلب وسيبه لمدة ثانيتين</p><button type="button" class="d-heart" aria-label="القلب — اضغط مطولًا">♡</button><p class="d-react" role="status">في الهدية الحقيقية، القلب بيكبر لما انتوا الاتنين تلمسوه في نفس الوقت من موبايلين.</p>`;
    const h = p.querySelector(".d-heart"); let t = 0;
    const start = e => { e.preventDefault(); h.classList.add("is-hold"); t = setTimeout(() => { h.classList.add("is-done"); h.textContent = "♥"; p.querySelector(".d-react").textContent = "اتقابلت اللمستين ♡ المفاجأة اتفتحت"; }, 1600); };
    const stop = () => { clearTimeout(t); h.classList.remove("is-hold"); };
    h.addEventListener("pointerdown", start); h.addEventListener("pointerup", stop); h.addEventListener("pointerleave", stop);
    h.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { h.classList.add("is-done"); h.textContent = "♥"; p.querySelector(".d-react").textContent = "اتقابلت اللمستين ♡"; } });
  } }
};
const tabs = $("#labTabs"), panel = $("#labPanel");
tabs.innerHTML = Object.entries(DEMOS).map(([k, d], i) => `<button type="button" role="tab" id="tab-${k}" aria-controls="labPanel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-demo="${k}"><b>${d.label}</b><small>${d.sub}</small></button>`).join("");
function choose(k, focus = false) {
  $$("[data-demo]", tabs).forEach(b => { const on = b.dataset.demo === k; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
  panel.setAttribute("aria-labelledby", `tab-${k}`); panel.innerHTML = ""; panel.className = `d-panel d-${k}`; DEMOS[k].render(panel);
}
tabs.addEventListener("click", e => { const b = e.target.closest("[data-demo]"); if (b) choose(b.dataset.demo); });
tabs.addEventListener("keydown", e => {
  const keys = Object.keys(DEMOS), cur = keys.indexOf($('[aria-selected="true"]', tabs).dataset.demo);
  const d = e.key === "ArrowLeft" ? 1 : e.key === "ArrowRight" ? -1 : 0; // RTL
  if (d) { e.preventDefault(); choose(keys[(cur + d + keys.length) % keys.length], true); }
});
choose("who");

/* ---------- FAQ: one open at a time ---------- */
$$(".h-faq details").forEach(d => d.addEventListener("toggle", () => { if (d.open) $$(".h-faq details").forEach(x => { if (x !== d) x.open = false; }); }));

/* ---------- sticky CTA appears only after the hero CTA scrolls away ---------- */
const sticky = $(".h-sticky"), heroCta = $(".h-hero .h-hero-ctas");
if (sticky && heroCta && "IntersectionObserver" in window) {
  sticky.classList.add("is-hidden");
  new IntersectionObserver(([e]) => sticky.classList.toggle("is-hidden", e.isIntersecting || e.boundingClientRect.top > 0)).observe(heroCta);
}
