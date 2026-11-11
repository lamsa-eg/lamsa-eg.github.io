// Single source of truth for commercial data on the client. Prices, limits and
// add-ons ALWAYS come from the database (via /api/public-config). This file
// contains no prices; when data is missing the UI shows a neutral state.
const MB = 1024 * 1024;

function legacyMaxGames(id) { return id === "premium" ? 3 : id === "memory" ? 2 : 0; }

export function normalizePackage(row) {
  const hasMaxGames = row.max_games !== null && row.max_games !== undefined && Number.isFinite(Number(row.max_games));
  const p = {
    id: String(row.id), label: String(row.label || row.id), price: Number(row.price),
    sortOrder: Number(row.sort_order || 0), maxImages: Number(row.max_images || 0), maxImageBytes: Number(row.max_image_bytes || 8 * MB),
    allowVideo: row.allow_video === true, maxVideoBytes: Number(row.max_video_bytes || 0),
    allowAudio: row.allow_audio === true, maxAudioBytes: Number(row.max_audio_bytes || 0), allowSong: row.allow_song === true,
    tagline: row.tagline ? String(row.tagline) : "",
    features: Array.isArray(row.features) ? row.features.map(String).filter(Boolean) : [],
    recommended: row.is_recommended === true,
    // packages.max_games comes from migration v38. Until it exists we mirror the
    // rule enforced by the order-wow-selection Edge Function.
    maxGames: hasMaxGames ? Number(row.max_games) : legacyMaxGames(row.id)
  };
  if (!Number.isFinite(p.price) || row.price === null || row.price === undefined) p.price = null;
  return p;
}

export function buildCatalog(cfg = {}) {
  const packages = (cfg.packages || []).map(normalizePackage).sort((a, b) => a.sortOrder - b.sortOrder);
  if (packages.length > 2 && !packages.some(p => p.recommended)) {
    // No explicit flag yet: recommend the middle package. This is a product
    // recommendation, never presented as a popularity claim.
    packages[Math.floor((packages.length - 1) / 2)].recommended = true;
  }
  const addons = new Map((cfg.wowAddons || []).filter(a => a && a.id).map(a => [a.id, { id: a.id, label: a.label, price: a.price == null ? null : Number(a.price) }]));
  const packs = (cfg.wowPacks || []).filter(p => p && p.id).map(p => ({ id: p.id, label: p.label, price: p.price == null ? null : Number(p.price) }));
  const zones = (cfg.shippingZones || []).map(z => ({ id: z.id, label: z.label, fee: z.fee === null || z.fee === undefined ? null : Number(z.fee) }));
  const games = Array.isArray(cfg.games) ? cfg.games : null;
  return {
    packages, zones, addons, packs, games, season: cfg.season || null, wowEnabled: cfg.wowEnabled !== false,
    pkg(id) { return packages.find(p => p.id === id) || null; },
    zone(id) { return zones.find(z => z.id === id) || null; },
    addon(id) { const a = addons.get(id); return a && Number.isFinite(a.price) ? a : null; },
    pack(id) { return packs.find(p => p.id === id && Number.isFinite(p.price)) || null; },
    minPrice() { const ps = packages.map(p => p.price).filter(Number.isFinite); return ps.length ? Math.min(...ps) : null; }
  };
}

export function money(v) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  return new Intl.NumberFormat("ar-EG-u-nu-latn", { maximumFractionDigits: 0 }).format(Number(v)) + " ج.م";
}
export function mb(bytes) { return Math.round(Number(bytes || 0) / MB); }

/** Feature bullets derived from the real package limits (used when the DB has no features text). */
export function packageFeatures(p) {
  if (p.features.length) return p.features;
  const f = [`حتى ${p.maxImages} صور`, "رسالة مكتوبة وصفحة ذكرى خاصة", "قطعة NFC مع QR"];
  if (p.allowSong) f.push("أغنية مميزة");
  if (p.allowVideo) f.push("فيديو");
  if (p.allowAudio) f.push("رسالة صوتية");
  f.push(p.maxGames > 0 ? `حتى ${p.maxGames === 1 ? "لعبة واحدة" : p.maxGames + " ألعاب"} من قصتكم` : "بدون ألعاب ضمن الباقة");
  return f;
}
