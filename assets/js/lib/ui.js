export const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function toast(message, ms = 3400) {
  let t = document.getElementById("l-toast");
  if (!t) { t = document.createElement("div"); t.id = "l-toast"; t.className = "l-toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.appendChild(t); }
  t.textContent = message; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), ms);
}

/** Thin banner while the device is offline. */
export function watchNetwork() {
  let bar = null;
  const update = () => {
    if (navigator.onLine) { bar?.remove(); bar = null; return; }
    if (!bar) { bar = document.createElement("div"); bar.className = "l-net"; bar.setAttribute("role", "status"); bar.textContent = "أنت غير متصل بالإنترنت — بياناتك محفوظة على جهازك وهنكمل أول ما الشبكة ترجع."; document.body.prepend(bar); }
  };
  addEventListener("online", update); addEventListener("offline", update); update();
}

/** Progressive reveal: content is visible without JS; animation is an enhancement only. */
export function reveal() {
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const els = $$("[data-reveal]").filter(e => e.getBoundingClientRect().top > innerHeight);
  document.documentElement.classList.add("l-js-reveal");
  els.forEach(e => e.classList.add("is-pending"));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.remove("is-pending"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px", threshold: 0.01 });
  els.forEach(e => io.observe(e));
}
