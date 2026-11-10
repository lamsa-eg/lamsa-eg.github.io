// LAMSA public API client. All calls go through the Cloudflare Pages Worker
// (/api/*), which adds the server-side gateway credential. No secrets here.
const CONFIG_CACHE_KEY = "lamsa:public-config:v38";
const CONFIG_TTL_MS = 60_000;

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, offline = false } = {}) { super(message); this.status = status; this.data = data; this.offline = offline; }
}

export function isOffline() { return typeof navigator !== "undefined" && navigator.onLine === false; }
export function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function apiPost(name, body = {}, { timeoutMs = 30_000, retries = 0 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (isOffline()) throw new ApiError("لا يوجد اتصال بالإنترنت. تأكد من الشبكة وحاول مرة أخرى.", { offline: true });
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const url = window.LAMSA_API ? window.LAMSA_API(name) : `/api/${encodeURIComponent(name)}`;
      const headers = (window.LAMSA_API_HEADERS || (h => h))({ "Content-Type": "application/json", "x-lamsa-form-version": "38" });
      const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal, cache: "no-store" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = new ApiError(data.error || `تعذر إكمال الطلب (${r.status})`, { status: r.status, data });
        // Retry only transient server failures, never validation errors.
        if (r.status >= 500 && attempt < retries) { lastError = err; await wait(800 * (attempt + 1)); continue; }
        throw err;
      }
      return data;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      lastError = new ApiError(e?.name === "AbortError" ? "الاتصال بطيء جدًا وانتهت المهلة. حاول مرة أخرى." : "تعذر الاتصال بخدمة لمسة. تأكد من الإنترنت وحاول مرة أخرى.", { offline: true });
      if (attempt < retries) { await wait(800 * (attempt + 1)); continue; }
      throw lastError;
    } finally { clearTimeout(timer); }
  }
  throw lastError;
}

/** Public catalog (packages, shipping zones, add-ons, games). Cached 60s per tab. */
export async function loadPublicConfig({ fresh = false } = {}) {
  if (!fresh) {
    try { const c = JSON.parse(sessionStorage.getItem(CONFIG_CACHE_KEY) || "null"); if (c && Date.now() - c.at < CONFIG_TTL_MS) return c.data; } catch {}
  }
  const data = await apiPost("public-config", {}, { retries: 1, timeoutMs: 15_000 });
  try { sessionStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ at: Date.now(), data })); } catch {}
  return data;
}
