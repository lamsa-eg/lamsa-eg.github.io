// Ad attribution + Meta Pixel. The Pixel loads only when an ID is set from the admin
// («الدفع والتسويق» → site_settings.meta_pixel). No personal data is sent to Meta.
import { loadPublicConfig } from "./api.js";

const ATTR_KEY = "lamsa_attr";
const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];
const store = (() => { try { return window.localStorage; } catch { return null; } })();

function capture() {
  try {
    const qs = new URLSearchParams(location.search), hit = {};
    for (const k of KEYS) { const v = qs.get(k); if (v) hit[k] = v.slice(0, k === "fbclid" ? 300 : 200); }
    const prev = JSON.parse(store?.getItem(ATTR_KEY) || "null");
    const ref = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer.slice(0, 200) : "";
    if (Object.keys(hit).length) {
      // Last ad click wins; keep when we first saw this visitor.
      store?.setItem(ATTR_KEY, JSON.stringify({ ...hit, landing: location.pathname.slice(0, 200), referrer: ref, first_seen: prev?.first_seen || new Date().toISOString(), ts: Date.now() }));
    } else if (!prev && ref) {
      store?.setItem(ATTR_KEY, JSON.stringify({ referrer: ref, landing: location.pathname.slice(0, 200), first_seen: new Date().toISOString(), ts: Date.now() }));
    }
  } catch {}
}

/** Attribution for create-order (expires after 30 days). */
export function getAttribution() {
  try {
    const a = JSON.parse(store?.getItem(ATTR_KEY) || "null");
    if (!a || Date.now() - Number(a.ts || 0) > 30 * 864e5) return null;
    const { ts, ...rest } = a; return rest;
  } catch { return null; }
}

let ready = null;
function loadPixel(id) {
  if (window.fbq) return;
  const q = function () { q.callMethod ? q.callMethod.apply(q, arguments) : q.queue.push(arguments); };
  q.push = q; q.loaded = true; q.version = "2.0"; q.queue = [];
  window.fbq = q; window._fbq = q;
  const s = document.createElement("script"); s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  window.fbq("init", id);
  window.fbq("track", "PageView");
}

function init() {
  capture();
  ready = loadPublicConfig().then(cfg => {
    const id = String(cfg?.metaPixelId || "");
    if (/^[0-9]{8,20}$/.test(id)) { loadPixel(id); return true; }
    return false;
  }).catch(() => false);
}

/** Fire a standard Pixel event (no-op when the Pixel is off). `once` dedupes per browser. */
export async function track(event, params = {}, { eventID, once } = {}) {
  if (!(await ready)) return;
  if (once) { const k = `lamsa_px_${once}`; try { if (store?.getItem(k)) return; store?.setItem(k, "1"); } catch {} }
  try { window.fbq("track", event, params, eventID ? { eventID } : undefined); } catch {}
}

if (typeof window !== "undefined" && !window.__lamsaMkt) { window.__lamsaMkt = true; init(); }
else ready = Promise.resolve(Boolean(window.fbq));
