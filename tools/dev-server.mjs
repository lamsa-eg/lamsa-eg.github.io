// LAMSA local development server.
// Serves the static site exactly like Cloudflare Pages (incl. /m/* rewrite and
// _redirects) and replaces the Cloudflare Worker + Supabase Edge Functions with
// an in-memory MOCK backend so the full journey (order -> admin publish ->
// memory -> games) can be tested offline. Mock data is fictional and this file
// is never part of the production bundle (see tools/build.mjs).
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, randomBytes } from "node:crypto";

const ROOT = normalize(process.env.LAMSA_ROOT ? join(process.cwd(), process.env.LAMSA_ROOT) : join(fileURLToPath(import.meta.url), "../.."));
const PORT = Number(process.env.PORT || 8788);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };

// ---------------- Mock catalog (fictional test fixture) ----------------
export const MOCK = {
  packages: [
    { id: "mini", label: "Mini", price: 299, sort_order: 10, max_images: 3, max_image_bytes: 8388608, allow_video: false, max_video_bytes: 0, allow_audio: false, max_audio_bytes: 0, allow_song: false, max_games: 0, is_recommended: false, tagline: "لمسة بسيطة وهادية" },
    { id: "memory", label: "Memory", price: 499, sort_order: 20, max_images: 8, max_image_bytes: 8388608, allow_video: false, max_video_bytes: 0, allow_audio: false, max_audio_bytes: 0, allow_song: true, max_games: 2, is_recommended: true, tagline: "حكاية متكاملة بصوركم وأغنيتكم" },
    { id: "premium", label: "Premium", price: 799, sort_order: 30, max_images: 12, max_image_bytes: 8388608, allow_video: true, max_video_bytes: 52428800, allow_audio: true, max_audio_bytes: 15728640, allow_song: true, max_games: 3, is_recommended: false, tagline: "الرحلة الكاملة بكل تفاصيلها" }
  ],
  shippingZones: [
    { id: "cairo", label: "القاهرة والجيزة", fee: 60, sort_order: 10 },
    { id: "other", label: "محافظة أخرى", fee: null, sort_order: 20 }
  ],
  wowAddons: [
    { id: "extra_game", label: "لعبة إضافية", price: 49 },
    { id: "hunt_stickers", label: "٣ ستيكرات صيد الكنز", price: 99 }
  ],
  wowPacks: [
    { id: "engagement", label: "خطوبة", price: 149 },
    { id: "apology", label: "اعتذار", price: 149 }
  ],
  games: null // null = no game_catalog table yet -> frontend shows the full registry
};

const orders = new Map(); // orderNumber -> order
const memories = new Map(); // slug -> memory
const uploads = new Map(); // path -> bytes
export const state = { orders, memories, uploads, fail: {} };

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== "string" && !Buffer.isBuffer(body);
  res.writeHead(status, { "Cache-Control": "no-store", "Content-Type": isJson ? "application/json; charset=utf-8" : headers["Content-Type"] || "text/plain", ...headers });
  res.end(isJson ? JSON.stringify(body) : body);
}
async function readBody(req) { const chunks = []; for await (const c of req) chunks.push(c); return Buffer.concat(chunks); }

function publicMemory(m) {
  const media = m.media.map(x => ({ kind: x.kind, url: x.url, caption: x.caption || "" }));
  const moments = m.moments.map(x => {
    const config = structuredClone(x.config);
    if (config.reward) { config.rewardLocked = true; delete config.reward; }
    return { id: x.id, type: x.type, config, sortOrder: x.sort_order, enabled: true };
  });
  return { slug: m.slug, senderName: m.senderName, recipientName: m.recipientName, recipientGender: m.recipientGender, simpleMode: false, memoryDate: m.memoryDate, occasion: m.occasion, intro: "", message: m.message, songTitle: m.songTitle || "", songUrl: m.songUrl || "", theme: m.theme, pageCopy: m.pageCopy || {}, advanced: m.advanced || {}, media, wow: moments.length ? { enabled: true, gates: {}, gateState: { locked: false, secretRequired: false }, moments, cacheable: false, serverNow: new Date().toISOString() } : undefined };
}

async function api(name, req, res) {
  if (state.fail[name]) return send(res, state.fail[name], { error: "خطأ تجريبي من الخادم" });
  let body = {};
  if (req.method === "POST") { try { body = JSON.parse((await readBody(req)).toString() || "{}"); } catch { return send(res, 400, { error: "Invalid JSON" }); } }
  switch (name) {
    case "public-config":
      return send(res, 200, { packages: MOCK.packages, shippingZones: MOCK.shippingZones, wowEnabled: true, turnstileSiteKey: "", wowAddons: MOCK.wowAddons, wowPacks: MOCK.wowPacks, games: MOCK.games, season: null, generatedAt: new Date().toISOString() });
    case "create-order": {
      const pkg = MOCK.packages.find(p => p.id === body.package);
      if (!pkg) return send(res, 400, { error: "الباقة غير متاحة" });
      if (body.consent?.accepted !== true) return send(res, 400, { error: "يجب الموافقة على الشروط وسياسة الخصوصية." });
      const c = body.customization || {}, a = body.shippingAddress || {};
      if (!c.senderName || !c.recipientName || !c.occasion || !a.street || !a.city || !a.area || !a.zoneId || !/^[+\d ()-]{7,24}$/.test(a.phone || "")) return send(res, 400, { error: "بيانات الطلب غير مكتملة" });
      for (const o of orders.values()) if (o.requestId === body.requestId) return send(res, 200, { ...o.result, reused: true });
      const id = randomUUID(), orderNumber = `ORD-TEST-${id.slice(0, 6).toUpperCase()}`, slug = `m-${randomBytes(8).toString("hex")}`, token = randomBytes(24).toString("hex");
      const zone = MOCK.shippingZones.find(z => z.id === a.zoneId);
      const tickets = (body.uploads || []).map(u => ({ clientIndex: u.clientIndex, clientName: u.name, path: `${id}/${randomUUID()}-${u.name}`, token: randomBytes(16).toString("hex"), kind: u.kind, alreadyUploaded: false }));
      const result = { orderNumber, trackingToken: token, memoryId: id, memorySlug: slug, uploads: tickets, basePrice: pkg.price, shippingFee: zone?.fee || 0, shippingPending: zone?.fee == null, totalAmount: pkg.price + (zone?.fee || 0) };
      orders.set(orderNumber, { id, requestId: body.requestId, orderNumber, token, slug, body, tickets, result, state: "uploading", games: [], status: "pending", createdAt: new Date().toISOString() });
      memories.set(slug, { slug, published: false, senderName: c.senderName, recipientName: c.recipientName, recipientGender: null, occasion: c.occasion, memoryDate: c.date, message: c.message, songTitle: c.songTitle, songUrl: c.songUrl, theme: c.theme, pageCopy: c.pageCopy, advanced: c.advanced, media: [], moments: [] });
      return send(res, 201, result);
    }
    case "complete-order": {
      const o = orders.get(body.orderNumber);
      if (!o || o.token !== body.trackingToken) return send(res, 401, { error: "بيانات الطلب غير صحيحة" });
      const missing = o.tickets.filter(t => !uploads.has(t.path));
      if (missing.length) return send(res, 409, { error: "بعض الملفات لم تكتمل" });
      o.state = "complete";
      const m = memories.get(o.slug);
      m.media = o.tickets.filter(t => t.kind === "image" || t.kind === "video" || t.kind === "audio").sort((x, y) => x.clientIndex - y.clientIndex).map(t => ({ kind: t.kind, url: `/__mock-upload/${encodeURIComponent(t.path)}`, caption: "" }));
      return send(res, 200, { ok: true, whatsappStatus: "pending" });
    }
    case "order-wow-selection": {
      const o = orders.get(body.orderNumber);
      if (!o || o.token !== body.trackingToken || o.state !== "complete") return send(res, 401, { error: "بيانات الطلب غير صحيحة" });
      const games = (body.games || []).filter(g => g.game !== "setup");
      const m = memories.get(o.slug);
      m.recipientGender = games[0]?.config?.__storyBuild?.recipientGender || body.games?.[0]?.config?.__storyBuild?.recipientGender || null;
      m.moments = games.map((g, i) => { const config = { ...g.config, game: g.game }; delete config.__storyBuild; return { id: randomUUID(), type: ["treasure", "coupons"].includes(g.game) ? g.game : "game", config, sort_order: 200 + i * 10 }; });
      o.games = body.games;
      return send(res, 200, { ok: true, count: m.moments.length });
    }
    case "attach-special-media": return send(res, 200, { ok: true, uploads: [] });
    case "order-notify-admin": return send(res, 200, { ok: true });
    case "abort-order": { const o = orders.get(body.orderNumber); if (o) o.state = "aborted"; return send(res, 200, { ok: true }); }
    case "track-order": { const o = orders.get(body.orderNumber); if (!o || o.token !== body.trackingToken) return send(res, 404, { error: "لم يتم العثور على الطلب" }); return send(res, 200, { orderNumber: o.orderNumber, status: o.status, submissionState: o.state, events: [] }); }
    case "public-memory": {
      const m = memories.get(String(body.slug || ""));
      if (!m || !m.published) return send(res, 404, { error: "الذكرى غير متاحة" });
      return send(res, 200, publicMemory(m));
    }
    case "wow-event": return send(res, 200, { ok: true, reward: body.event === "win" || body.event === "skip" || body.event === "status" ? { type: "message", text: "مكافأة تجريبية بعد الفوز ♡" } : null });
    default: return send(res, 404, { error: "Not found (mock)" });
  }
}

const redirects = [];
try { for (const line of (await readFile(join(ROOT, "_redirects"), "utf8")).split("\n")) { const [from, to, code] = line.trim().split(/\s+/); if (from && to && !from.startsWith("#")) redirects.push({ from, to, code: Number(code || 302) }); } } catch {}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      let p = decodeURIComponent(url.pathname);
      const BASE = process.env.LAMSA_BASE || "";
      if (BASE) { if (!p.startsWith(BASE + "/") && p !== BASE) return send(res, 404, "outside base"); p = p.slice(BASE.length) || "/"; }
      // Test hooks (mock only)
      if (p === "/__mock/publish" && req.method === "POST") { const { orderNumber } = JSON.parse((await readBody(req)).toString()); const o = orders.get(orderNumber); if (!o) return send(res, 404, { error: "no order" }); memories.get(o.slug).published = true; return send(res, 200, { slug: o.slug }); }
      if (p === "/__mock/orders") return send(res, 200, [...orders.values()].map(o => ({ orderNumber: o.orderNumber, slug: o.slug, state: o.state, games: o.games, body: o.body })));
      if (p === "/__mock/fail" && req.method === "POST") { Object.assign(state.fail, JSON.parse((await readBody(req)).toString())); return send(res, 200, { ok: true }); }
      if (p.startsWith("/__mock-upload/")) { const b = uploads.get(decodeURIComponent(p.slice(15))); return b ? send(res, 200, b.data, { "Content-Type": b.type }) : send(res, 404, "missing"); }
      if (p === "/upload/order" && req.method === "PUT") { const path = url.searchParams.get("path"); const data = await readBody(req); if (!path) return send(res, 400, { error: "Invalid upload ticket" }); uploads.set(path, { data, type: req.headers["content-type"] }); return send(res, 200, { Key: path }); }
      if (p === "/env.js" && !process.env.LAMSA_BASE) return send(res, 200, `window.LAMSA_ENV=${JSON.stringify({ SUPABASE_URL: "https://mock-project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "mock-publishable", SITE_URL: `http://${req.headers.host}` })};`, { "Content-Type": TYPES[".js"] });
      if (p.startsWith("/api/")) return api(p.slice(5).replace(/\/+$/, ""), req, res);
      const r = redirects.find(x => x.from === p);
      if (r) { res.writeHead(r.code, { Location: r.to + url.search }); return res.end(); }
      if (p.startsWith("/m/")) p = "/memory.html";
      if (p.endsWith("/")) p += "index.html";
      let file = normalize(join(ROOT, p));
      if (!file.startsWith(ROOT)) return send(res, 403, "Forbidden");
      // Cloudflare Pages "pretty URLs": /order -> /order.html
      let st = await stat(file).catch(() => null);
      if (!st && !extname(file)) { const alt = file + ".html"; st = await stat(alt).catch(() => null); if (st) file = alt; }
      if (!st || st.isDirectory()) { const nf = await readFile(join(ROOT, "404.html")); return send(res, 404, nf, { "Content-Type": TYPES[".html"] }); }
      send(res, 200, await readFile(file), { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    } catch (e) { console.error(e); send(res, 500, { error: String(e) }); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, () => console.log(`LAMSA dev (mock backend) on http://localhost:${PORT}`));
}
