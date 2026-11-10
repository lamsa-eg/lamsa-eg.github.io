// Resolves a TikTok link (incl. short links) to the official embed player URL.
import { cors, out, rateAllowed, trustedIp } from "../_shared/wow.ts";

const idOf = (v: string) => { try { return new URL(v).pathname.match(/\/(?:video|photo)\/(\d{8,25})(?:\/|$)/i)?.[1] || ""; } catch { return ""; } };
const allowed = (v: string) => { try { const u = new URL(v); const h = u.hostname.toLowerCase(); return u.protocol === "https:" && (h === "tiktok.com" || h.endsWith(".tiktok.com")); } catch { return false; } };

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!(await rateAllowed("tiktok-resolve", trustedIp(req), 30, 600))) return out({ error: "محاولات كثيرة" }, 429);
    const input = (new URL(req.url).searchParams.get("url") || "").trim();
    if (!input || input.length > 700 || !allowed(input)) return out({ error: "رابط TikTok غير صالح" }, 400);
    let id = idOf(input);
    if (!id) { try { const o = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(input)}`, { headers: { Accept: "application/json" } }); if (o.ok) { const d = await o.json(); const m = String(d?.html || "").match(/data-video-id=["'](\d{8,25})["']/i); if (m) id = m[1]; } } catch {} }
    if (!id) { try { const r = await fetch(input, { redirect: "follow" }); id = idOf(r.url || ""); } catch {} }
    if (!id) return out({ error: "تعذر التعرف على فيديو TikTok" }, 422);
    return out({ ok: true, id, embedUrl: `https://www.tiktok.com/player/v1/${encodeURIComponent(id)}?controls=1&progress_bar=1&play_button=1&volume_control=1&fullscreen_button=1&loop=0&autoplay=0&rel=0` });
  } catch (e) { console.error(e); return out({ error: "تعذر تشغيل TikTok" }, 500); }
});
