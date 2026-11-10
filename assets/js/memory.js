// LAMSA memory experience v40 — «غروب على النيل».
// Envelope → hero → stations (letter, photos, video, voice, song, WOW games) → ending.
// Data: /api/public-memory (slug from /m/<slug>), ?demo=1, or ?preview=<memoryId> for staff.
const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const qs = new URLSearchParams(location.search);
const body = document.body;
const SLUG_RE = /^m-[a-f0-9]{16}(?:[a-f0-9]{16})?$/i;

/* ---------- demo memory (illustrations only, fictional names) ---------- */
const DEMO = {
  slug: "demo", senderName: "آدم", recipientName: "ليلى", recipientGender: "f", memoryDate: "2024-06-14", occasion: "ذكرى أول لقاء", theme: "black_rose",
  pageCopy: { pageTitle: "سنة على أول قهوة", messageTitle: "كلمة من القلب", galleryTitle: "محطات حكايتنا", songSectionTitle: "أغنيتنا", closingText: "وكل محطة جاية… أحلى عشان إنتِ فيها." },
  message: "فاكرة أول يوم؟ كنتِ متأخرة ربع ساعة، وأنا كنت عامل نفسي مش واخد بالي.\nمن يومها وكل تفصيلة صغيرة بقت ليها معنى: القهوة، والكورنيش، وضحكتك لما بتكسبي في أي نقاش.\nالصفحة دي معمولة عشان تفتكري إن كل ده كان حقيقي… وإن لسه الجاي أحلى.",
  songTitle: "", songUrl: "", advanced: { layoutStyle: "carousel", fontSize: "normal" },
  media: [
    { kind: "logo", url: "/assets/demo-v2/coffee.svg", caption: "" },
    { kind: "image", url: "/assets/demo-v2/coffee.svg", caption: "أول قهوة" },
    { kind: "image", url: "/assets/demo-v2/corniche.svg", caption: "مشية الكورنيش" },
    { kind: "image", url: "/assets/demo-v2/birthday.svg", caption: "أول عيد ميلاد سوا" },
    { kind: "image", url: "/assets/img/scene-gift.svg", caption: "والهدية دي ✦" }
  ],
  wow: { enabled: true, gates: {}, gateState: { locked: false, secretRequired: false }, moments: [
    { id: "d1000000-0000-4000-8000-000000000001", type: "game", sortOrder: 210, enabled: true, config: { game: "quiz", anchor: "after_gallery", title: "مين فينا؟", questions: [{ q: "مين اللي بيتأخر دايمًا؟", options: ["آدم", "ليلى", "إحنا الاتنين"], answer: 1, reactions: ["قريب… بس لأ 😄", "صح ♡ ربع ساعة بالظبط", "قريب… بس لأ 😄"] }, { q: "مين قال «بحبك» الأول؟", options: ["آدم", "ليلى", "إحنا الاتنين"], answer: 0, reactions: ["صح ♡ وفاكر اليوم كمان", "لأ 😄", "لأ 😄"] }], perfect: "حافظة تفاصيلنا كلها ♡", good: "قريب جدًا 😌", bad: "محتاجين نحكي تاني 😂", skippable: true, playOnce: false, reward: { type: "message", text: "الإجابة الحقيقية: إنتِ أحلى حاجة حصلت ♡" } } },
    { id: "d1000000-0000-4000-8000-000000000002", type: "game", sortOrder: 220, enabled: true, config: { game: "order_story", anchor: "after_gallery", title: "رتّب ذكرياتنا", events: [{ title: "أول قهوة", when: "يونيو", imageRef: 0 }, { title: "مشية الكورنيش", when: "يوليو", imageRef: 1 }, { title: "أول عيد ميلاد سوا", when: "أكتوبر", imageRef: 2 }], correctOrder: [0, 1, 2], winText: "بالظبط كده بدأت حكايتنا ♡", skippable: true, playOnce: false } },
    { id: "d1000000-0000-4000-8000-000000000003", type: "game", sortOrder: 230, enabled: true, config: { game: "open_when", anchor: "before_end", title: "افتحيها لما…", items: [{ title: "لما أوحشك", text: "بصي على القمر… أنا كمان بصّيت عليه دلوقتي." }, { title: "لما تكوني متضايقة", text: "خدي نفس، وكلميني. أنا هنا دايمًا." }], skippable: false, playOnce: false } }
  ] }
};

/* ---------- loading ---------- */
function slugFromUrl() { const s = qs.get("m") || qs.get("slug") || location.pathname.split("/").filter(Boolean).pop() || ""; return SLUG_RE.test(s) ? s : ""; }

async function fetchMemory(slug) {
  const early = window.__LAMSA_EARLY; window.__LAMSA_EARLY = null;
  if (early && !sessionStorage.getItem(`lamsa-wow-unlock:${slug}`)) { try { return await early; } catch (e) { throw e; } }
  const r = await fetch(window.LAMSA_API("public-memory"), { method: "POST", headers: window.LAMSA_API_HEADERS({ "Content-Type": "application/json" }), cache: "no-store", body: JSON.stringify({ slug, wowToken: sessionStorage.getItem(`lamsa-wow-unlock:${slug}`) || "" }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || "Request failed"), { status: r.status });
  return d;
}

async function adminPreview(memoryId) {
  const { db } = await import("./client-cf-v4.js");
  const s = db(); if (!s) throw new Error("not configured");
  const { data: { session } } = await s.auth.getSession(); if (!session) throw new Error("not authorized");
  const { data: m, error } = await s.from("memories").select("id,slug,sender_name,recipient_name,memory_date,occasion,intro,message,song_title,song_url,theme,page_copy,advanced_customization,created_at,recipient_gender").eq("id", memoryId).single();
  if (error) throw error;
  const { data: rows } = await s.from("memory_media").select("kind,storage_bucket,storage_path,caption,sort_order").eq("memory_id", memoryId).order("sort_order");
  const groups = new Map(); for (const r of rows || []) { const b = r.storage_bucket || "memory-media"; groups.set(b, [...(groups.get(b) || []), r]); }
  const media = (await Promise.all([...groups].map(async ([b, list]) => { const { data } = await s.storage.from(b).createSignedUrls(list.map(x => x.storage_path), 900); return (data || []).map((x, i) => ({ ...list[i], url: x.signedUrl })).filter(x => x.url); }))).flat().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  let wow = null;
  const { data: w } = await s.from("memory_wow").select("enabled,gates").eq("memory_id", memoryId).maybeSingle();
  if (w?.enabled) { const { data: mm } = await s.from("memory_wow_moments").select("id,type,config,sort_order,enabled").eq("memory_id", memoryId).eq("enabled", true).order("sort_order"); wow = { enabled: true, gates: {}, gateState: { locked: false, secretRequired: false }, previewBypass: true, cacheable: false, moments: (mm || []).map(x => ({ id: x.id, type: x.type, config: x.config || {}, sortOrder: x.sort_order, enabled: true })) }; }
  return { slug: m.slug, senderName: m.sender_name, recipientName: m.recipient_name, recipientGender: m.recipient_gender, memoryDate: m.memory_date, occasion: m.occasion, intro: m.intro, message: m.message, songTitle: m.song_title, songUrl: m.song_url, theme: m.theme, pageCopy: m.page_copy || {}, advanced: m.advanced_customization || {}, media, wow, preview: true };
}

/* ---------- helpers ---------- */
const g = (d, m, f) => (d.recipientGender === "f" ? f : m);
function formatDate(v) { if (!v) return ""; try { return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(new Date(v)); } catch { return ""; } }
function show(id, on = true) { const el = $(id); if (el) el.hidden = !on; return el; }
function youtubeId(u) { try { const x = new URL(u); if (/youtu\.be$/.test(x.hostname)) return x.pathname.slice(1, 12); if (/youtube\.com$/.test(x.hostname.replace(/^www\.|^m\.|^music\./, ""))) return x.searchParams.get("v") || (x.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/) || [])[1] || ""; } catch {} return ""; }
const isTikTok = u => { try { return /(^|\.)tiktok\.com$/.test(new URL(u).hostname); } catch { return false; } };
const isAudio = u => /\.(mp3|m4a|aac|ogg|wav)(\?|$)/i.test(u || "");

/* ---------- render ---------- */
function render(d) {
  const copy = d.pageCopy || {}, adv = d.advanced || {}, media = Array.isArray(d.media) ? d.media : [];
  const images = media.filter(x => x.kind === "image" && x.url), cover = media.find(x => x.kind === "logo")?.url || images[0]?.url, bg = media.find(x => x.kind === "background")?.url || cover;
  body.dataset.theme = ["black_rose", "black_gold", "birthday_balloons", "elegant_cream"].includes(d.theme) ? d.theme : "black_rose";
  body.dataset.font = adv.fontSize || "normal"; body.dataset.layout = adv.layoutStyle || "carousel";
  document.title = `${d.recipientName || "ذكرى"} — ذكرى من ${d.senderName || "لمسة"}`;

  $("openKicker").textContent = g(d, "فيه حاجة مستنياك ✦", "فيه حاجة مستنياكي ✦");
  $("openTitle").textContent = d.recipientName ? `${d.recipientName}،` : "ذكرى خاصة";
  $("openHint").textContent = g(d, "المس الختم عشان تبدأ الرحلة", "المسي الختم عشان تبدئي الرحلة");

  $("occasion").textContent = d.occasion || "";
  if (cover) { $("cover").src = cover; $("cover").alt = "صورة الغلاف"; }
  if (bg) $("heroBg").style.backgroundImage = `url("${String(bg).replace(/"/g, "%22")}")`;
  $("forLine").textContent = d.senderName ? `من ${d.senderName} إلى` : "";
  $("names").textContent = d.recipientName || "";
  $("pageTitle").textContent = copy.pageTitle || "";
  const date = formatDate(d.memoryDate); $("date").textContent = date; if (d.memoryDate) $("date").setAttribute("datetime", d.memoryDate);

  if (copy.intro || d.intro) { show("introChapter"); $("intro").textContent = copy.intro || d.intro; }
  if (d.message) {
    show("messageChapter"); $("messageTitle").textContent = copy.messageTitle || "كلمة من القلب";
    // Word-by-word reveal (text nodes only — never innerHTML with user text).
    const box = $("message"); box.replaceChildren();
    d.message.split(/(\s+)/).forEach(t => { if (/^\s+$/.test(t)) box.append(t); else if (t) { const s = document.createElement("span"); s.className = "w"; s.textContent = t; box.append(s); } });
    $("signature").textContent = d.senderName ? `— ${d.senderName}` : "";
  }
  if (images.length) renderGallery(images, copy.galleryTitle);
  const video = media.find(x => x.kind === "video" && x.url);
  if (video) { show("videoChapter"); $("videoTitle").textContent = copy.videoTitle || "لحظات حية"; $("video").src = video.url; }
  const voice = media.find(x => x.kind === "audio" && x.url);
  if (voice) { show("audioChapter"); $("audioTitle").textContent = copy.audioTitle || "صوت من القلب"; $("audio").src = voice.url; }
  if (d.songUrl) renderSong(d, copy);
  $("closingText").textContent = copy.closingText || g(d, "ودي كانت البداية بس… الجاي أحلى.", "ودي كانت البداية بس… الجاي أحلى.");
  $("endFrom").textContent = d.senderName ? `بحب، ${d.senderName}` : "";
}

function renderGallery(images, title) {
  show("galleryChapter"); $("galleryTitle").textContent = title || "لحظاتنا";
  const host = $("gallery");
  host.innerHTML = images.map((x, i) => `<figure data-i="${i}"><img src="${esc(x.url)}" alt="${esc(x.caption || `صورة ${i + 1}`)}" loading="${i < 2 ? "eager" : "lazy"}" decoding="async"><figcaption>${esc(x.caption || "")}</figcaption></figure>`).join("");
  host.querySelectorAll("img").forEach(img => img.addEventListener("error", () => img.classList.add("is-broken"), { once: true }));
  const count = () => { const w = host.firstElementChild?.getBoundingClientRect().width || 1; const i = Math.min(images.length, Math.round(Math.abs(host.scrollLeft) / (w + 12)) + 1); $("photoCount").textContent = `${i} / ${images.length}`; };
  host.addEventListener("scroll", () => requestAnimationFrame(count), { passive: true }); count();
  const step = dir => { const w = host.firstElementChild.getBoundingClientRect().width + 12; host.scrollBy({ left: dir * -w, behavior: "smooth" }); }; // RTL: next = scroll left
  $("nextPhoto").onclick = () => step(1); $("prevPhoto").onclick = () => step(-1);
  host.addEventListener("keydown", e => { if (e.key === "ArrowLeft") step(1); if (e.key === "ArrowRight") step(-1); });
  host.addEventListener("click", e => { const img = e.target.closest("figure")?.querySelector("img"); if (img && !img.classList.contains("is-broken")) openLightbox(img.src, img.alt); });
  $("galleryNav").hidden = images.length < 2;
}

function renderSong(d, copy) {
  show("songChapter"); $("songSectionTitle").textContent = copy.songSectionTitle || "أغنيتنا"; $("songTitle").textContent = d.songTitle || "";
  const host = $("songPlayer"), card = host.closest(".lm-song"), url = d.songUrl, yt = youtubeId(url);
  const playBtn = (label, onclick) => { const b = document.createElement("button"); b.type = "button"; b.className = "l-btn l-btn-sun"; b.textContent = label; b.onclick = onclick; host.replaceChildren(b); };
  if (isAudio(url)) { const a = document.createElement("audio"); a.controls = true; a.preload = "none"; a.src = url; a.onplay = () => { pauseAmbient(); card.classList.add("is-playing"); }; a.onpause = () => card.classList.remove("is-playing"); host.replaceChildren(a); return; }
  if (yt) return playBtn("▶ شغّل الأغنية", () => { pauseAmbient(); card.classList.add("is-playing"); host.innerHTML = `<iframe title="${esc(d.songTitle || "أغنيتنا")}" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`; });
  if (isTikTok(url)) return playBtn("▶ شغّل من TikTok", async () => {
    pauseAmbient(); try { const r = await fetch(`${window.LAMSA_API("tiktok-resolve")}?url=${encodeURIComponent(url)}`, { headers: window.LAMSA_API_HEADERS({}) }); const x = await r.json(); if (!r.ok) throw 0; host.innerHTML = `<iframe title="TikTok" src="${esc(x.embedUrl)}" allow="autoplay; encrypted-media; fullscreen" style="aspect-ratio:9/16;max-height:80vh"></iframe>`; card.classList.add("is-playing"); }
    catch { host.innerHTML = `<a class="l-btn l-btn-ghost" href="${esc(url)}" target="_blank" rel="noopener">افتح الأغنية ↗</a>`; }
  });
  try { const u = new URL(url); if (/^https?:$/.test(u.protocol)) host.innerHTML = `<a class="l-btn l-btn-ghost" href="${esc(u.href)}" target="_blank" rel="noopener">اسمع الأغنية ↗</a>`; } catch {}
}

/* ---------- interactions ---------- */
function openLightbox(src, alt) { $("lightboxImg").src = src; $("lightboxImg").alt = alt || ""; $("lightbox").hidden = false; $("lightboxClose").focus(); }
function closeLightbox() { $("lightbox").hidden = true; $("lightboxImg").removeAttribute("src"); }
$("lightboxClose").onclick = closeLightbox; $("lightbox").addEventListener("click", e => { if (e.target.id === "lightbox") closeLightbox(); });
addEventListener("keydown", e => { if (e.key === "Escape" && !$("lightbox").hidden) closeLightbox(); });

const ambient = $("ambient"), musicBtn = $("music");
function setMusic(on) { musicBtn.setAttribute("aria-pressed", String(on)); musicBtn.setAttribute("aria-label", on ? "إيقاف الموسيقى" : "تشغيل الموسيقى"); }
async function playAmbient() { try { ambient.volume = 0.35; await ambient.play(); setMusic(true); } catch { setMusic(false); } }
function pauseAmbient() { ambient.pause(); setMusic(false); }
musicBtn.onclick = () => (ambient.paused ? playAmbient() : pauseAmbient());
["video", "audio"].forEach(id => $(id).addEventListener("play", pauseAmbient));

function stations() {
  const list = [...document.querySelectorAll(".lm-station:not([hidden]), .wow-sec, #closing")];
  const bar = $("progressBar"), label = $("progressLabel");
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; e.target.classList.remove("is-pending");
    if (e.target.id === "messageChapter") $("message").classList.add("is-in");
    const all = [...document.querySelectorAll(".lm-station:not([hidden]), .wow-sec, #closing")], i = all.indexOf(e.target);
    if (i >= 0) { label.textContent = `المحطة ${i + 1} من ${all.length} · ${e.target.dataset.station || "مفاجأة"}`; bar.style.width = `${((i + 1) / all.length) * 100}%`; }
  }), { threshold: 0.25 });
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) { document.documentElement.classList.add("lm-js"); list.forEach(el => { if (el.classList.contains("lm-station")) el.classList.add("is-pending"); }); }
  else $("message").classList.add("is-in");
  list.forEach(el => io.observe(el));
  // WOW sections are added later: observe them as they appear.
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList?.contains("wow-sec")) io.observe(n); }))).observe($("story"), { childList: true });
}

async function share(d) {
  const url = location.href.split("#")[0], text = `${d.recipientName ? d.recipientName + "، " : ""}فيه ذكرى معمولة لك ✦`;
  try { if (navigator.share) await navigator.share({ title: "لمسة", text, url }); else { await navigator.clipboard.writeText(url); $("share").textContent = "اتنسخ الرابط ✓"; } } catch {}
}

function openEnvelope(d) {
  if (body.dataset.state !== "ready") return;
  body.dataset.state = "opening"; navigator.vibrate?.(30);
  playAmbient();
  setTimeout(() => {
    body.dataset.state = "open"; show("page"); show("progress"); show("music");
    $("progress").removeAttribute("aria-hidden");
    stations();
    $("hero").scrollIntoView({ block: "start" });
    if (d.wow?.enabled === true) import("./wow/wow-core.js").then(({ mountWow }) => mountWow(d)).catch(e => console.warn("LAMSA WOW", e));
    $("names").setAttribute("tabindex", "-1"); $("names").focus({ preventScroll: true });
  }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900);
}

function showError(err) {
  const notFound = err?.status === 404 || /غير متاح|not found|404/i.test(String(err?.message || ""));
  const el = $("memoryError"); el.hidden = false;
  el.textContent = !navigator.onLine ? "أنت غير متصل بالإنترنت. اتصل بالشبكة وافتح الرابط تاني."
    : notFound ? "الرابط ده مش صحيح أو الذكرى لسه ما اتنشرتش. اتأكد إنك فتحت الرابط كامل أو امسح الـQR تاني."
    : "تعذر فتح الذكرى الآن. حاول تحديث الصفحة.";
  $("openTitle").textContent = "لمسة"; $("openBtn").hidden = true; $("openHint").hidden = true; body.dataset.state = "error";
}

async function main() {
  let d;
  try {
    if (qs.get("demo") === "1") d = DEMO;
    else if (qs.get("preview")) d = await adminPreview(qs.get("preview"));
    else { const slug = slugFromUrl(); if (!slug) throw Object.assign(new Error("not found"), { status: 404 }); d = await fetchMemory(slug); }
  } catch (e) { console.warn("memory unavailable", e?.message || e); return showError(e); }
  render(d);
  $("replay").onclick = () => { scrollTo({ top: 0, behavior: "smooth" }); };
  $("share").onclick = () => share(d);
  if (d.preview || d.slug === "demo") $("share").hidden = d.preview === true;
  // A WOW wax-seal / lock / secret gate replaces our envelope (wow-core renders it).
  const gated = d.wow?.gates?.wax_seal?.enabled || d.wow?.gateState?.locked || d.wow?.gateState?.secretRequired;
  body.dataset.state = "ready"; $("openBtn").disabled = false;
  if (gated) { body.dataset.state = "open"; show("page"); show("music"); stations(); import("./wow/wow-core.js").then(({ mountWow }) => mountWow(d)).catch(e => console.warn("LAMSA WOW", e)); return; }
  $("openBtn").onclick = () => openEnvelope(d);
  $("openBtn").focus({ preventScroll: true });
}
main();
