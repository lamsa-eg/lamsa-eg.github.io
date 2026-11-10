import { qs, escapeHtml, httpUrl } from "./common-cf-v4.js";

/* =========================================================
   LAMSA V28 — TikTok + Song + Cinematic Slideshow
   تحسينات صفحة الذكرى: الأداء، الحركة، المعرض، الفيديو، المشاركة والوصول
   ========================================================= */

let galleryTimer = null;
let galleryIndex = 0;
let galleryCount = 0;
let galleryItems = [];
let startX = 0;
let deltaX = 0;
let activeLightboxIndex = -1;
let messageAnimated = false;
let galleryMode = "carousel";
let selectedSongMode = "default";
let selectedSongUrl = "";
let youtubeFrame = null;
let youtubeVideoId = "";
let youtubePlaying = false;
let tiktokFrame = null;
let tiktokPostId = "";
let tiktokPlaying = false;
let tiktokReady = false;
let tiktokPlayRequested = false;

const THEMES = new Set(["black_rose", "black_gold", "gold_black", "birthday_balloons", "elegant_cream"]);
const TEXT_COLORS = new Set(["default", "gold", "silver", "rose", "warm"]);
const FONT_SIZES = new Set(["normal", "large", "xlarge"]);
const LAYOUTS = new Set(["grid", "grid2", "gallery", "carousel"]);
const EFFECTS = new Set(["none", "fade", "glow", "particles"]);
const LOGO_POSITIONS = new Set(["none", "top", "bottom", "corner"]);

/* تجربة حقيقية كاملة تظهر عند memory.html?demo=1 */
const DEMO = {
  slug: "demo",
  senderName: "آدم",
  recipientName: "ليلى",
  memoryDate: "2026-02-14",
  createdAt: "2026-09-15T12:00:00Z",
  occasion: "ذكرى سنوية · تجربة LAMSA",
  intro: "في تفاصيل صغيرة بنفتكرها أكتر من الأيام الكبيرة… نظرة، صورة، مكان، وأغنية أول ما تبدأ ترجع كل الحكاية.",
  message: "من أول يوم، وكل لحظة بينا بتضيف حاجة جميلة للحكاية.\nالصفحة دي معمولة عشان الذكريات ما تفضلش مجرد صور في الموبايل… تبقى مكان نرجع له في أي وقت.\nوكل مرة تفتحيها، تفتكري إن أجمل حاجة حصلتلي… إنك بقيتي جزء من أيامي.",
  songTitle: "أغنيتنا — LAMSA Romantic Theme",
  songUrl: "https://lamsagift.pages.dev/assets/audio/lamsa-romantic-ambient.mp3",
  theme: "elegant_cream",
  pageCopy: {
    pageTitle: "حكاية بدأت بلحظة… وكملت بذكريات",
    intro: "في تفاصيل صغيرة بنفتكرها أكتر من الأيام الكبيرة…",
    messageTitle: "رسالة من القلب",
    galleryTitle: "لحظات من الحكاية",
    videoTitle: "لحظة تتحرك من جديد",
    songSectionTitle: "أغنيتنا",
    closingText: "كل ذكرى حلوة تستحق مكان يفضل مفتوح ليها.\n♡ آدم وليلى ♡"
  },
  advanced: {
    pageTextColor: "rose",
    fontSize: "large",
    layoutStyle: "carousel",
    pageEffect: "fade",
    logoPosition: "none",
    engraving: ""
  },
  media: [
    { kind: "logo", url: "/assets/demo/demo-1.webp", caption: "صورة الكوفر" },
    { kind: "background", url: "/assets/demo/demo-3.webp", caption: "خلفية الذكرى" },
    { kind: "image", url: "/assets/demo/demo-1.webp", caption: "بداية الحكاية" },
    { kind: "image", url: "/assets/demo/demo-2.webp", caption: "هدية بلمستنا" },
    { kind: "image", url: "/assets/demo/demo-4.webp", caption: "ذكرى مميزة" },
    { kind: "image", url: "/assets/demo/demo-5.webp", caption: "كل تفصيلة لها معنى" },
    { kind: "image", url: "/assets/demo/demo-6.webp", caption: "لحظات بتفضل" },
    { kind: "video", url: "/assets/demo/demo-video.mp4", caption: "فيديو الذكرى" }
  ],
  wow:{enabled:true,theme:null,gates:{wax_seal:{enabled:true,label:"دي ذكرى معمولة لك بشكل خاص"}},gateState:{locked:false,secretRequired:false},moments:[
    {id:"11111111-1111-4111-8111-111111111111",type:"game",sortOrder:210,enabled:true,config:{game:"puzzle",anchor:"after_gallery",storyTitle:"افتكري أول صورة",title:"البازل",autoImage:true,size:2,skippable:true,playOnce:true,reward:{type:"message",text:"كل صورة بينا بداية لحكاية أكبر ♡"}}},
    {id:"33333333-3333-4333-8333-333333333333",type:"game",sortOrder:212,enabled:true,config:{game:"quiz",anchor:"after_gallery",title:"مين فينا؟",questions:[{q:"مين اللي بيتأخر أكتر؟",options:["آدم","ليلى","إحنا الاتنين"],answer:0,reactions:["صح ♡ ربع ساعة بالظبط 😄","قريب… بس لأ 😄","قريب… بس لأ 😄"]},{q:"مين قال «بحبك» الأول؟",options:["آدم","ليلى","إحنا الاتنين"],answer:1,reactions:["قريب… 😄","صح ♡ وفاكرة اليوم كمان","قريب… 😄"]}],perfect:"حافظة تفاصيلنا كلها ♡",good:"قريب جدًا 😌",bad:"محتاجين نقعد نحكي تاني 😂",skippable:true,playOnce:false,reward:{type:"message",text:"الإجابة الحقيقية: إنتِ أحلى حاجة حصلت ♡"}}},
    {id:"44444444-4444-4444-8444-444444444444",type:"game",sortOrder:214,enabled:true,config:{game:"open_when",anchor:"after_gallery",title:"افتحها عندما…",items:[{title:"لما أوحشك",text:"افتكري إن فيه حد بيعدّ الأيام لحد ما يشوفك."},{title:"لما تكوني متضايقة",text:"خدي نفس… وكلميني. أنا هنا دايمًا."}],skippable:false,playOnce:false}},
    {id:"22222222-2222-4222-8222-222222222222",type:"game",sortOrder:220,enabled:true,config:{game:"scratch",anchor:"before_end",storyTitle:"مفاجأة أخيرة",title:"اكشطي المفاجأة",text:"إنتِ أجمل تفصيلة في الحكاية",skippable:true,playOnce:true,reward:{type:"message",text:"دي كانت لمسة صغيرة من اللي جاي ♡"}}}
  ]}
};

const cacheKey = slug => `lamsa-memory-v28-wow-p2:${slug}`;

function cachedMemory(slug) {
  try {
    const raw = sessionStorage.getItem(cacheKey(slug));
    if (!raw) return null;
    const box = JSON.parse(raw);
    if (!box?.ts || Date.now() - box.ts > 300000) {
      sessionStorage.removeItem(cacheKey(slug));
      return null;
    }
    return box.data || null;
  } catch {
    return null;
  }
}

function storeMemory(slug, data) {
  try {
    if (data?.wow?.cacheable === false) return;
    sessionStorage.setItem(cacheKey(slug), JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

async function publicMemory(slug) {
  if (window.__LAMSA_EARLY) {
    const pending = window.__LAMSA_EARLY;
    window.__LAMSA_EARLY = null;
    return await pending;
  }
  const response = await fetch("/api/public-memory", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-lamsa-form-version": "2" },
    body: JSON.stringify({ slug, wowToken: sessionStorage.getItem(`lamsa-wow-unlock:${slug}`) || "" }),
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString("ar-EG", {
      year: "numeric", month: "long", day: "numeric"
    });
  } catch {
    return "";
  }
}

function formatCreatedDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("ar-EG", {
      year: "numeric", month: "long", day: "numeric"
    });
  } catch {
    return "";
  }
}

function ready(el) {
  if (el) requestAnimationFrame(() => el.classList.add("ready"));
}

function text(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value || "";
  if (value) ready(el);
}

/* ---------- Lightbox + حفظ الصورة ---------- */
function closeLightbox() {
  const lb = document.getElementById("lightbox");
  if (!lb) return;
  lb.classList.remove("open");
  lb.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  activeLightboxIndex = -1;
}

function openLightbox(src, alt, index = -1) {
  const lb = document.getElementById("lightbox");
  const img = document.getElementById("lightboxImg");
  if (!lb || !img) return;
  img.src = src;
  img.alt = alt || "صورة من الذكرى";
  img.dataset.source = src;
  activeLightboxIndex = index;
  lb.classList.add("open");
  lb.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  document.getElementById("lightboxClose")?.focus({ preventScroll: true });
}

async function saveLightboxImage() {
  const img = document.getElementById("lightboxImg");
  const src = img?.dataset.source || img?.src;
  if (!src) return;
  const btn = document.getElementById("lightboxDownload");
  const old = btn?.textContent;
  if (btn) btn.textContent = "جاري الحفظ…";
  try {
    const r = await fetch(src, { credentials: "omit" });
    if (!r.ok) throw new Error("download failed");
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LAMSA-memory-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch {
    window.open(src, "_blank", "noopener");
  } finally {
    if (btn) btn.textContent = old || "حفظ الصورة";
  }
}

function lightboxMove(step) {
  if (!galleryItems.length || activeLightboxIndex < 0) return;
  const next = (activeLightboxIndex + step + galleryItems.length) % galleryItems.length;
  const item = galleryItems[next];
  openLightbox(item.url, item.caption || `صورة ${next + 1}`, next);
}

/* ---------- Gallery ---------- */
function stopGallery() {
  if (galleryTimer) {
    clearInterval(galleryTimer);
    galleryTimer = null;
  }
}

function imageAt(i) {
  return document.querySelector(`.gallery-slide[data-index="${i}"] img`);
}

function markImage(img) {
  if (!img) return;
  const done = () => img.classList.add("loaded");
  if (img.complete && img.naturalWidth > 0) done();
  else {
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  }
}

function ensureImage(i, high = false) {
  if (!galleryCount) return;
  const idx = (i + galleryCount) % galleryCount;
  const img = imageAt(idx);
  if (!img) return;
  markImage(img);
  if (img.src) return;
  const src = img.dataset.src;
  if (!src) return;
  if (high) img.fetchPriority = "high";
  img.src = src;
  img.removeAttribute("data-src");
}

function preloadAround(i) {
  ensureImage(i, true);
  ensureImage(i + 1);
  ensureImage(i - 1);
}

function updateCounter() {
  const c = document.getElementById("galleryCounter");
  if (!c) return;
  c.hidden = galleryCount <= 1;
  c.textContent = galleryCount > 1 ? `${galleryIndex + 1} / ${galleryCount}` : "";
}

function startGallery() {
  stopGallery();
  if (galleryCount <= 1 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  galleryTimer = setInterval(() => setGallery(galleryIndex + 1), galleryMode === "slideshow" ? 2800 : 4600);
}

function setGallery(i) {
  if (!galleryCount) return;
  galleryIndex = (i + galleryCount) % galleryCount;
  preloadAround(galleryIndex);
  const track = document.getElementById("galleryTrack");
  if (track && galleryMode !== "slideshow") track.style.transform = `translate3d(-${galleryIndex * 100}%,0,0)`;
  document.querySelectorAll(".gallery-slide").forEach((el, idx) => el.classList.toggle("active", idx === galleryIndex));
  document.querySelectorAll(".gallery-dot").forEach((el, idx) => el.classList.toggle("active", idx === galleryIndex));
  updateCounter();
}

function clearGallery() {
  stopGallery();
  galleryCount = 0;
  galleryIndex = 0;
  galleryItems = [];
  galleryMode = "carousel";
  const track = document.getElementById("galleryTrack");
  const dots = document.getElementById("galleryDots");
  const staticBox = document.getElementById("galleryStatic");
  const nav = document.getElementById("galleryNav");
  const counter = document.getElementById("galleryCounter");
  const carousel = document.getElementById("galleryCarousel");
  if (track) { track.innerHTML = ""; track.style.transform = "translate3d(0,0,0)"; track.classList.remove("slideshow-track"); }
  if (dots) dots.innerHTML = "";
  if (staticBox) { staticBox.innerHTML = ""; staticBox.hidden = true; }
  if (carousel) { carousel.hidden = false; carousel.classList.remove("slideshow-mode"); }
  if (nav) nav.hidden = true;
  if (counter) counter.hidden = true;
}

function buildCarousel(imgs) {
  clearGallery();
  galleryMode = "slideshow";
  galleryItems = imgs;
  const track = document.getElementById("galleryTrack");
  const dots = document.getElementById("galleryDots");
  const nav = document.getElementById("galleryNav");
  const viewport = document.getElementById("galleryCarousel");
  if (!track || !dots || !nav || !viewport) return;
  galleryCount = imgs.length;
  if (!imgs.length) return;

  viewport.classList.add("slideshow-mode");
  track.classList.add("slideshow-track");
  track.style.transform = "none";
  track.innerHTML = imgs.map((x, i) => `
    <figure class="gallery-slide slideshow-slide ${i === 0 ? "active" : ""}" data-index="${i}">
      <img ${i < 2
        ? `src="${x.url}" ${i === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'}`
        : `data-src="${x.url}" loading="lazy"`}
        decoding="async" alt="${escapeHtml(x.caption || `صورة ${i + 1}`)}">
      <span class="slideshow-shade" aria-hidden="true"></span>
    </figure>`).join("");

  track.querySelectorAll("img").forEach(markImage);
  dots.innerHTML = imgs.map((_, i) => `<button type="button" class="gallery-dot ${i === 0 ? "active" : ""}" data-go="${i}" aria-label="الصورة ${i + 1} من ${imgs.length}"></button>`).join("");
  nav.hidden = true;

  track.querySelectorAll(".gallery-slide").forEach((slide, idx) => {
    slide.addEventListener("click", () => {
      ensureImage(idx, true);
      openLightbox(imgs[idx].url, imgs[idx].caption || `صورة ${idx + 1}`, idx);
    });
  });

  viewport.setAttribute("dir", "ltr");
  viewport.onpointerdown = e => {
    startX = e.clientX;
    deltaX = 0;
    stopGallery();
    try { viewport.setPointerCapture(e.pointerId); } catch {}
  };
  viewport.onpointermove = e => {
    if (!startX) return;
    deltaX = e.clientX - startX;
  };
  viewport.onpointerup = e => {
    if (Math.abs(deltaX) > 35) setGallery(galleryIndex + (deltaX < 0 ? 1 : -1));
    startX = 0;
    deltaX = 0;
    try { viewport.releasePointerCapture(e.pointerId); } catch {}
    startGallery();
  };
  viewport.onpointercancel = () => { startX = 0; deltaX = 0; startGallery(); };

  setGallery(0);
  startGallery();
  setTimeout(() => preloadAround(0), 250);
}

function buildStaticGallery(imgs, layout) {
  clearGallery();
  galleryItems = imgs;
  const carousel = document.getElementById("galleryCarousel");
  const staticBox = document.getElementById("galleryStatic");
  if (!carousel || !staticBox) return;
  carousel.hidden = true;
  staticBox.hidden = false;
  staticBox.className = `gallery-static layout-${layout}`;
  staticBox.innerHTML = imgs.map((x, i) => `
    <figure class="gallery-item" data-index="${i}">
      <img src="${x.url}" loading="${i === 0 ? "eager" : "lazy"}" ${i === 0 ? 'fetchpriority="high"' : ""} decoding="async" alt="${escapeHtml(x.caption || `صورة ${i + 1}`)}">
    </figure>`).join("");
  staticBox.querySelectorAll("img").forEach(markImage);
  staticBox.querySelectorAll(".gallery-item").forEach((item, idx) => item.addEventListener("click", () => {
    openLightbox(imgs[idx].url, imgs[idx].caption || `صورة ${idx + 1}`, idx);
  }));
}

function buildGallery(imgs, layout) {
  if (layout === "carousel") buildCarousel(imgs);
  else buildStaticGallery(imgs, layout);
}

/* ---------- الرسالة تظهر عند وصول المستخدم لها ---------- */
function prepareMessage(textValue) {
  const box = document.getElementById("message");
  if (!box) return;
  const lines = (textValue || "").split(/\n+/).filter(Boolean);
  messageAnimated = false;
  if (!lines.length) {
    box.textContent = "";
    return;
  }
  box.innerHTML = lines.map(line => `<span class="line">${escapeHtml(line)}</span>`).join("");
}

function playMessageAnimation() {
  if (messageAnimated) return;
  messageAnimated = true;
  document.querySelectorAll("#message .line").forEach((line, idx) => {
    setTimeout(() => line.classList.add("show"), Math.min(170 * idx + 80, 1200));
  });
}

/* ---------- تحميل الصوت عند الاقتراب ---------- */
function lazyAudio(chapter, audio, url) {
  if (!url || !audio) return;
  audio.dataset.src = url;
  const load = () => {
    if (!audio.src) {
      audio.src = audio.dataset.src;
      audio.removeAttribute("data-src");
    }
  };
  if (!("IntersectionObserver" in window)) { load(); return; }
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) {
      load();
      io.disconnect();
    }
  }, { rootMargin: "260px 0px" });
  io.observe(chapter);
}

/* ---------- الفيديو لا يحمّل إلا عند الضغط على Play ---------- */
function setupVideoPlayer(video, url) {
  if (!video || !url) return;
  const launch = document.getElementById("videoLaunch");
  video.removeAttribute("src");
  video.dataset.src = url;
  video.preload = "none";
  video.controls = false;
  if (launch) launch.hidden = false;

  const start = async () => {
    if (!video.src) {
      video.src = video.dataset.src;
      video.removeAttribute("data-src");
      video.load();
    }
    video.controls = true;
    video.classList.add("is-ready");
    if (launch) launch.hidden = true;
    try { await video.play(); } catch {}
  };

  launch?.addEventListener("click", start);
  video.addEventListener("click", () => {
    if (!video.src) start();
  }, { once: true });
}

/* ---------- صورة الخلفية تتدرج بدل ظهور مفاجئ ---------- */
function setHeroImage(url) {
  if (!url) return;
  const heroBg = document.getElementById("heroBg");
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn?.saveData || /2g/i.test(conn?.effectiveType || "")) return;
  setTimeout(() => {
    const probe = new Image();
    probe.decoding = "async";
    probe.onload = () => {
      heroBg.style.backgroundImage = `linear-gradient(180deg,rgba(10,7,8,.30),rgba(5,4,5,.72)),url('${url.replace(/'/g, "%27")}')`;
      requestAnimationFrame(() => heroBg.classList.add("v24-loaded"));
    };
    probe.src = url;
  }, 120);
}

function setCover(url) {
  const img = document.getElementById("coverPhoto");
  if (!img) return;
  img.setAttribute("href", url || "/assets/img/monogram.svg");
}

/* ---------- الأغنية المختارة تصبح موسيقى صفحة الذكرى ---------- */
function youtubeIdFromUrl(value) {
  try {
    const u = new URL(value);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") return (u.pathname.split("/").filter(Boolean)[0] || "").slice(0, 20);
    if (host.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return (u.searchParams.get("v") || "").slice(0, 20);
      const parts = u.pathname.split("/").filter(Boolean);
      if (["shorts", "embed", "live"].includes(parts[0])) return (parts[1] || "").slice(0, 20);
    }
  } catch {}
  return "";
}

function isDirectAudioUrl(value) {
  try {
    const u = new URL(value, location.href);
    return /\.(mp3|m4a|aac|wav|ogg|oga)(?:$|[?#])/i.test(u.pathname + u.search + u.hash) || u.pathname.startsWith("/assets/audio/");
  } catch {
    return false;
  }
}


function isTikTokUrl(value) {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    return u.protocol === "https:" && (host === "tiktok.com" || host.endsWith(".tiktok.com"));
  } catch {
    return false;
  }
}

function tiktokIdFromUrl(value) {
  try {
    const u = new URL(value);
    const m = u.pathname.match(/\/(?:video|photo)\/(\d{8,25})(?:\/|$)/i);
    return m?.[1] || "";
  } catch {
    return "";
  }
}

function tiktokCommand(type, value = undefined) {
  if (!tiktokFrame?.contentWindow) return;
  try {
    const payload = { type, "x-tiktok-player": true };
    if (value !== undefined) payload.value = value;
    tiktokFrame.contentWindow.postMessage(payload, "https://www.tiktok.com");
  } catch {}
}

function setTikTokFrame(embedUrl, originalUrl, id = "") {
  const wrap = document.getElementById("tiktokEmbedWrap");
  const frame = document.getElementById("tiktokPlayer");
  const external = document.getElementById("tiktokExternalLink");
  if (!wrap || !frame) return;
  tiktokPostId = id || tiktokPostId;
  frame.src = embedUrl;
  tiktokFrame = frame;
  tiktokReady = false;
  tiktokPlaying = false;
  tiktokPlayRequested = false;
  wrap.hidden = false;
  if (external) external.href = originalUrl || selectedSongUrl;
}

async function setupTikTokEmbed(url) {
  const directId = tiktokIdFromUrl(url);
  if (directId) {
    const embed = `https://www.tiktok.com/player/v1/${encodeURIComponent(directId)}?controls=1&progress_bar=1&play_button=1&volume_control=1&fullscreen_button=1&loop=0&autoplay=0&music_info=1&description=1&rel=0`;
    setTikTokFrame(embed, url, directId);
    return true;
  }
  try {
    const response = await fetch(`/api/tiktok-resolve?url=${encodeURIComponent(url)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.embedUrl) throw new Error(data?.error || "TikTok resolve failed");
    setTikTokFrame(data.embedUrl, data.resolvedUrl || url, data.id || "");
    return true;
  } catch (e) {
    console.warn("TikTok embed unavailable", e);
    const wrap = document.getElementById("tiktokEmbedWrap");
    if (wrap) wrap.hidden = true;
    return false;
  }
}

function initTikTokMessages() {
  addEventListener("message", event => {
    if (event.origin !== "https://www.tiktok.com") return;
    const data = event.data;
    if (!data || data["x-tiktok-player"] !== true) return;
    if (data.type === "onPlayerReady") {
      tiktokReady = true;
      if (tiktokPlayRequested) {
        tiktokCommand("unMute");
        tiktokCommand("play");
      }
      ambientButtonState();
      return;
    }
    if (data.type === "onStateChange") {
      tiktokPlaying = Number(data.value) === 1;
      if ([0,2].includes(Number(data.value))) tiktokPlayRequested = false;
      ambientButtonState();
    }
  });
}

function ytCommand(func) {
  try {
    youtubeFrame?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
  } catch {}
}

function ensureYouTubePlayer() {
  if (!youtubeVideoId) return null;
  if (youtubeFrame?.isConnected) return youtubeFrame;
  const iframe = document.createElement("iframe");
  iframe.id = "selectedSongYouTube";
  iframe.className = "selected-song-youtube";
  iframe.title = "أغنية الذكرى";
  iframe.allow = "autoplay; encrypted-media";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeVideoId)}?enablejsapi=1&autoplay=1&loop=1&playlist=${encodeURIComponent(youtubeVideoId)}&controls=0&playsinline=1&rel=0&modestbranding=1`;
  iframe.addEventListener("load", () => {
    if (ambientWanted) {
      ytCommand("playVideo");
      youtubePlaying = true;
      ambientButtonState();
    }
  });
  document.body.appendChild(iframe);
  youtubeFrame = iframe;
  return iframe;
}

function configureSelectedSong(url) {
  selectedSongUrl = url || "";
  youtubeVideoId = youtubeIdFromUrl(selectedSongUrl);
  const ambient = document.getElementById("ambientMusic");
  const tiktokWrap = document.getElementById("tiktokEmbedWrap");
  if (tiktokWrap) tiktokWrap.hidden = true;
  if (!ambient || !selectedSongUrl) return;

  if (isTikTokUrl(selectedSongUrl)) {
    selectedSongMode = "tiktok";
    ambient.pause();
    youtubePlaying = false;
    tiktokPlaying = false;
    tiktokPlayRequested = false;
    setupTikTokEmbed(selectedSongUrl).finally(ambientButtonState);
    ambientButtonState();
    return;
  }

  if (isDirectAudioUrl(selectedSongUrl)) {
    selectedSongMode = "audio";
    if (ambient.src !== selectedSongUrl) {
      ambient.pause();
      ambient.src = selectedSongUrl;
      ambient.load();
    }
    if (ambientWanted) playAmbient();
    return;
  }

  if (youtubeVideoId) {
    selectedSongMode = "youtube";
    ambient.pause();
    youtubePlaying = false;
    if (ambientWanted) playAmbient();
    return;
  }

  /* Spotify / Apple Music وغيرها: رابط خارجي فقط. */
  selectedSongMode = "external";
  ambient.pause();
  youtubePlaying = false;
  tiktokPlaying = false;
  ambientButtonState();
}

/* ---------- الموسيقى المحيطة: نحاول التشغيل ثم ننتظر أول تفاعل لو المتصفح منع autoplay ---------- */
let ambientWanted = true;

function ambientButtonState() {
  const audio = document.getElementById("ambientMusic");
  const btn = document.getElementById("musicToggle");
  if (!audio || !btn) return;
  const playing = selectedSongMode === "youtube" ? youtubePlaying : selectedSongMode === "tiktok" ? tiktokPlaying : (!audio.paused && selectedSongMode !== "external");
  btn.classList.toggle("tiktok-mode", selectedSongMode === "tiktok");
  btn.classList.toggle("off", !playing || !ambientWanted);
  btn.classList.toggle("waiting", ambientWanted && !playing && selectedSongMode !== "external" && selectedSongMode !== "tiktok");
  btn.classList.toggle("unsupported", selectedSongMode === "external");
  btn.setAttribute("aria-pressed", String(playing));
  btn.setAttribute("aria-label", selectedSongMode === "tiktok" ? "تشغيل فيديو TikTok داخل الذكرى" : selectedSongMode === "external" ? "افتح رابط الأغنية من قسم أغنيتنا" : "تشغيل أو إيقاف أغنية الذكرى");
}

async function playAmbient() {
  const audio = document.getElementById("ambientMusic");
  if (!audio || !ambientWanted) return false;

  if (selectedSongMode === "youtube") {
    ensureYouTubePlayer();
    ytCommand("playVideo");
    youtubePlaying = true;
    ambientButtonState();
    return true;
  }
  if (selectedSongMode === "tiktok") {
    tiktokPlayRequested = true;
    document.getElementById("songChapter")?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (tiktokReady) {
      tiktokCommand("unMute");
      tiktokCommand("play");
    }
    ambientButtonState();
    return true;
  }
  if (selectedSongMode === "external") {
    ambientButtonState();
    return false;
  }

  try {
    audio.volume = 0.24;
    await audio.play();
    ambientButtonState();
    return true;
  } catch {
    ambientButtonState();
    return false;
  }
}

function pauseAmbientPlayback() {
  const audio = document.getElementById("ambientMusic");
  if (selectedSongMode === "youtube") {
    ytCommand("pauseVideo");
    youtubePlaying = false;
  } else if (selectedSongMode === "tiktok") {
    tiktokPlayRequested = false;
    tiktokCommand("pause");
    tiktokPlaying = false;
  } else if (audio && !audio.paused) {
    audio.pause();
  }
  ambientButtonState();
}

function initAmbient() {
  const ambient = document.getElementById("ambientMusic");
  const btn = document.getElementById("musicToggle");
  if (!ambient || !btn) return;
  ambient.volume = 0.24;

  const arm = () => {
    if (ambientWanted && selectedSongMode !== "tiktok") playAmbient();
    removeEventListener("pointerdown", arm, true);
    removeEventListener("keydown", arm, true);
  };
  addEventListener("pointerdown", arm, true);
  addEventListener("keydown", arm, true);

  btn.addEventListener("click", async e => {
    e.preventDefault();
    e.stopPropagation();
    const currentlyPlaying = selectedSongMode === "youtube" ? youtubePlaying : selectedSongMode === "tiktok" ? tiktokPlaying : !ambient.paused;
    if (currentlyPlaying) {
      ambientWanted = false;
      pauseAmbientPlayback();
    } else {
      if (selectedSongMode === "external" && selectedSongUrl) {
        window.open(selectedSongUrl, "_blank", "noopener");
        return;
      }
      ambientWanted = true;
      await playAmbient();
    }
    ambientButtonState();
  });

  ambient.addEventListener("play", ambientButtonState);
  ambient.addEventListener("pause", ambientButtonState);

  const voice = document.getElementById("audio");
  const video = document.getElementById("video");
  for (const media of [voice, video]) {
    if (!media) continue;
    media.addEventListener("play", () => {
      const wasPlaying = selectedSongMode === "youtube" ? youtubePlaying : !ambient.paused;
      if (wasPlaying) {
        ambient.dataset.resume = "1";
        pauseAmbientPlayback();
      }
    });
    const resume = () => {
      if (ambient.dataset.resume === "1" && ambientWanted) {
        delete ambient.dataset.resume;
        playAmbient();
      }
    };
    media.addEventListener("pause", resume);
    media.addEventListener("ended", resume);
  }

  ambientButtonState();
}

function applyAdvanced(raw) {
  const a = raw && typeof raw === "object" ? raw : {};
  const pageTextColor = TEXT_COLORS.has(a.pageTextColor) ? a.pageTextColor : "default";
  const fontSize = FONT_SIZES.has(a.fontSize) ? a.fontSize : "normal";
  const layoutStyle = LAYOUTS.has(a.layoutStyle) ? a.layoutStyle : "carousel";
  const pageEffect = EFFECTS.has(a.pageEffect) ? a.pageEffect : "none";
  const logoPosition = LOGO_POSITIONS.has(a.logoPosition) ? a.logoPosition : "none";
  document.body.dataset.textColor = pageTextColor;
  document.body.dataset.fontSize = fontSize;
  document.body.dataset.effect = pageEffect;
  document.body.dataset.layout = layoutStyle;
  return { ...a, pageTextColor, fontSize, layoutStyle, pageEffect, logoPosition };
}

/* ---------- Scroll reveal + الرسالة ---------- */
function observeExperience() {
  const chapters = [...document.querySelectorAll(".chapter:not([hidden])")];
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    chapters.forEach(ch => ch.classList.add("in-view"));
    playMessageAnimation();
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in-view");
      const title = entry.target.querySelector(".section-title")?.textContent?.trim();
      if (title) document.getElementById("memoryProgressLabel").textContent = title;
      if (entry.target.id === "messageChapter") playMessageAnimation();
      io.unobserve(entry.target);
    });
  }, { threshold: 0.10, rootMargin: "80px 0px -5%" });
  chapters.forEach(ch => io.observe(ch));
}

/* ---------- شريط تقدم الصفحة باستخدام requestAnimationFrame ---------- */
function initProgress() {
  const bar = document.getElementById("memoryProgressBar");
  const txt = document.getElementById("memoryProgressText");
  const hero = document.querySelector(".hero");
  let ticking = false;
  const update = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const pct = Math.min(100, Math.max(0, (scrollY / max) * 100));
    if (bar) bar.style.width = `${pct.toFixed(1)}%`;
    if (txt) txt.textContent = `${Math.round(pct)}%`;
    document.body.classList.toggle("progress-visible", scrollY > Math.min(180, (hero?.offsetHeight || 500) * 0.28));
    ticking = false;
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  update();
}

/* ---------- مشاركة الذكرى ---------- */
async function shareMemory() {
  const btn = document.getElementById("shareMemory");
  const title = document.getElementById("names")?.textContent?.trim() || "LAMSA — ذكرى خاصة";
  const data = { title, text: "ذكرى خاصة عبر LAMSA", url: location.href };
  try {
    if (navigator.share) {
      await navigator.share(data);
      return;
    }
    await navigator.clipboard.writeText(location.href);
    const old = btn.textContent;
    btn.textContent = "✓";
    setTimeout(() => { btn.textContent = old; }, 1300);
  } catch (e) {
    if (e?.name !== "AbortError") console.warn("share failed", e);
  }
}

function updateMeta(d) {
  const names = [d.senderName, d.recipientName].filter(Boolean).join(" ♡ ");
  const title = names ? `${names} — ذكرى LAMSA` : "LAMSA — ذكرى خاصة";
  const desc = d.occasion ? `${d.occasion} · ذكرى رقمية خاصة عبر LAMSA` : "ذكرى رقمية خاصة عبر LAMSA";
  document.title = title;
  document.getElementById("ogTitle")?.setAttribute("content", title);
  document.getElementById("ogDescription")?.setAttribute("content", desc);
  const media = d.media || [];
  const socialImage = media.find(x => x.kind === "logo")?.url || media.find(x => x.kind === "image")?.url;
  if (socialImage && /^https?:\/\//i.test(socialImage)) document.getElementById("ogImage")?.setAttribute("content", socialImage);
}

function initSystemScheme() {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const apply = () => { document.documentElement.dataset.systemScheme = media.matches ? "dark" : "light"; };
  apply();
  media.addEventListener?.("change", apply);
}

function setCreatedMeta(d) {
  const el = document.getElementById("createdMeta");
  if (!el) return;
  const created = formatCreatedDate(d.createdAt || d.created_at || "");
  el.textContent = created ? `تم إنشاء هذه الذكرى في: ${created}` : "تم إنشاء هذه الذكرى بعناية عبر LAMSA";
}

function render(d) {
  const selectedTheme = THEMES.has(d.theme) ? d.theme : "black_rose";
  const theme = selectedTheme === "gold_black" ? "black_gold" : selectedTheme;
  document.body.dataset.theme = theme;
  const copy = d.pageCopy && typeof d.pageCopy === "object" ? d.pageCopy : {};
  const advanced = applyAdvanced(d.advanced);

  text("occasion", d.occasion || "");
  text("pageTitle", copy.pageTitle || "");
  text("names", [d.senderName, d.recipientName].filter(Boolean).join(" ♡ "));
  text("date", formatDate(d.memoryDate));

  const intro = copy.intro || d.intro || "";
  if (intro) {
    document.getElementById("introChapter").hidden = false;
    text("intro", intro);
  }

  const message = d.message || "";
  const messageTitle = copy.messageTitle || "كلمة من القلب";
  if (message || messageTitle) {
    document.getElementById("messageChapter").hidden = false;
    text("messageTitle", messageTitle);
    prepareMessage(message);
  }

  const media = d.media || [];
  const cover = media.find(x => x.kind === "logo");
  const background = media.find(x => x.kind === "background");
  const imgs = media.filter(x => x.kind === "image" || x.kind === "cover");
  const fallbackImage = imgs[0]?.url || "";

  setCover(cover?.url || fallbackImage);
  setHeroImage(background?.url || fallbackImage);

  if (imgs.length) {
    document.getElementById("galleryChapter").hidden = false;
    text("galleryTitle", copy.galleryTitle || "لحظاتنا");
    buildGallery(imgs, advanced.layoutStyle);
  }

  const audioItem = media.find(x => x.kind === "audio");
  const audioChapter = document.getElementById("audioChapter");
  audioChapter.hidden = !audioItem;
  if (audioItem) {
    text("audioTitle", copy.audioTitle || "صوت من القلب");
    lazyAudio(audioChapter, document.getElementById("audio"), audioItem.url);
  }

  const videoItem = media.find(x => x.kind === "video");
  const videoChapter = document.getElementById("videoChapter");
  videoChapter.hidden = !videoItem;
  if (videoItem) {
    text("videoTitle", copy.videoTitle || "لحظات حية");
    setupVideoPlayer(document.getElementById("video"), videoItem.url);
  }

  const song = httpUrl(d.songUrl);
  const songChapter = document.getElementById("songChapter");
  songChapter.hidden = !song;
  if (song) {
    text("songSectionTitle", copy.songSectionTitle || "أغنيتنا");
    const songLink = document.getElementById("song");
    songLink.href = song;
    document.getElementById("songTitle").textContent = d.songTitle || "أغنية الذكرى";
    configureSelectedSong(song);
  }

  text("closingText", copy.closingText || "");
  setCreatedMeta(d);
  updateMeta(d);

  requestAnimationFrame(() => {
    document.body.classList.add("experience-ready");
    observeExperience();
    initProgress();
    // LAMSA WOW: the ONE post-render hook. Non-WOW memories never import WOW code or CSS.
    if (d?.wow?.enabled === true) {
      import("./wow/wow-core.js").then(({ mountWow }) => mountWow(d)).catch(e => console.warn("LAMSA WOW", e));
    }
  });
}

async function adminPreview(memoryId) {
  await import("./config-cf-v4.js");
  const { db } = await import("./client-cf-v4.js");
  const supabase = db();
  if (!supabase) throw new Error("not configured");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("not authorized");

  const { data: m, error } = await supabase
    .from("memories")
    .select("id,slug,sender_name,recipient_name,memory_date,occasion,intro,message,song_title,song_url,theme,page_copy,advanced_customization,created_at")
    .eq("id", memoryId)
    .single();
  if (error) throw error;

  const { data: rows, error: mediaError } = await supabase
    .from("memory_media")
    .select("kind,storage_bucket,storage_path,caption,sort_order")
    .eq("memory_id", memoryId)
    .order("sort_order");
  if (mediaError) throw mediaError;

  const groups = new Map();
  for (const row of rows || []) {
    const bucket = row.storage_bucket || "memory-media";
    const arr = groups.get(bucket) || [];
    arr.push(row);
    groups.set(bucket, arr);
  }

  const chunks = await Promise.all([...groups.entries()].map(async ([bucket, bucketRows]) => {
    const { data, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrls(bucketRows.map(x => x.storage_path), 900);
    if (signError) return [];
    return (data || []).map((signed, i) => ({ ...bucketRows[i], url: signed.signedUrl })).filter(x => x.url);
  }));

  let wow = null;
  try {
    const { data: w } = await supabase.from("memory_wow").select("enabled,pack,theme,gates").eq("memory_id", memoryId).maybeSingle();
    if (w?.enabled) {
      const { data: moments } = await supabase.from("memory_wow_moments").select("id,type,config,sort_order,enabled").eq("memory_id", memoryId).eq("enabled", true).order("sort_order");
      const g = w.gates || {};
      wow = { enabled: true, pack: w.pack || null, theme: w.theme || null, previewBypass: true, cacheable: false,
        gates: { wax_seal:{enabled:!!g.wax_seal?.enabled,initials:g.wax_seal?.initials||"",label:g.wax_seal?.label||""}, locked:{enabled:!!g.locked?.enabled,unlock_at:g.locked?.unlock_at||null}, secret_question:{enabled:!!g.secret_question?.enabled,question:g.secret_question?.question||"",hint:g.secret_question?.hint||""}},
        gateState:{locked:false,secretRequired:false}, moments:(moments||[]).map(x=>({id:x.id,type:x.type,config:x.config||{},sortOrder:x.sort_order,enabled:x.enabled})) };
    }
  } catch (e) { console.warn("WOW preview", e); }

  return {
    slug: m.slug,
    senderName: m.sender_name,
    recipientName: m.recipient_name,
    memoryDate: m.memory_date,
    createdAt: m.created_at,
    occasion: m.occasion,
    intro: m.intro,
    message: m.message,
    songTitle: m.song_title,
    songUrl: m.song_url,
    theme: m.theme,
    pageCopy: m.page_copy || {},
    advanced: m.advanced_customization || {},
    media: chunks.flat().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    wow
  };
}

function showError(err) {
  const el = document.getElementById("memoryError");
  if (!el) return;
  const notFound = /غير متاح|not found|404/i.test(String(err?.message || ""));
  el.textContent = !navigator.onLine ? "أنت غير متصل بالإنترنت. اتصل بالشبكة وافتح الرابط تاني." : notFound ? "الرابط ده مش صحيح أو الذكرى لسه ما اتنشرتش. اتأكد إنك فتحت الرابط كامل أو امسح الـQR تاني." : "تعذر فتح الذكرى الآن. حاول تحديث الصفحة.";
  el.classList.add("show");
  document.body.classList.add("experience-ready");
}

function initControls() {
  document.getElementById("startJourney")?.addEventListener("click", () => {
    if (ambientWanted && selectedSongMode !== "tiktok") playAmbient();
    document.getElementById("story")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("shareMemory")?.addEventListener("click", shareMemory);
  document.getElementById("lightboxDownload")?.addEventListener("click", saveLightboxImage);

  document.getElementById("lightbox")?.addEventListener("click", e => {
    if (e.target.id === "lightbox" || e.target.id === "lightboxClose") closeLightbox();
  });

  addEventListener("keydown", e => {
    const open = document.getElementById("lightbox")?.classList.contains("open");
    if (e.key === "Escape") closeLightbox();
    if (open && e.key === "ArrowLeft") lightboxMove(1);
    if (open && e.key === "ArrowRight") lightboxMove(-1);
  });
}

async function resolveHuntSlug(){
  const params=new URLSearchParams(location.search),k=params.get("k"),clue=params.get("clue");if(!k||clue===null)return"";
  const cfg=await fetch("/api/public-config",{cache:"no-store"}).then(r=>r.json()),sitekey=String(cfg.turnstileSiteKey||"");if(!sitekey)throw new Error("حماية ستيكر الكنز غير مفعلة");
  const gate=document.createElement("div");gate.className="hunt-verify";gate.style.cssText="position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:24px;background:#100b0ed9;color:#fff;text-align:center";gate.innerHTML='<div style="max-width:360px;padding:24px;border:1px solid #d9a4b355;border-radius:22px;background:#171014"><b>لحظة واحدة…</b><p>أكّد إنك شخص حقيقي عشان نفتح خطوة الكنز.</p><div data-turnstile></div></div>';document.body.appendChild(gate);
  if(!window.turnstile)await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
  const token=await new Promise(resolve=>window.turnstile.render(gate.querySelector("[data-turnstile]"),{sitekey,callback:resolve}));
  const r=await fetch("/api/wow-hunt-step",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clue:Number(clue),k,turnstileToken:token})}),d=await r.json();gate.remove();if(!r.ok)throw new Error(d.error||"الستيكر غير صالح");sessionStorage.setItem(`lamsa-hunt-step:${d.slug}`,String(d.clue));return d.slug||"";
}

async function load() {
  initSystemScheme();
  initTikTokMessages();
  initAmbient();
  initControls();

  const preview = qs("preview");
  if (preview) {
    try {
      render(await adminPreview(preview));
      return;
    } catch (e) {
      console.warn("memory unavailable", e?.message || e);
      showError(e);
      return;
    }
  }

  if (qs("demo") === "1") {
    document.body.dataset.demo = "1";
    render(DEMO);
    return;
  }

  let slug = qs("slug") || location.pathname.split("/").filter(Boolean).pop();
  if((slug==="m"||!slug)&&qs("k"))slug=await resolveHuntSlug();
  try {
    const cached = cachedMemory(slug);
    if (cached) {
      render(cached);
      publicMemory(slug).then(fresh => {
        const changed = Boolean(fresh?.wow?.enabled) !== Boolean(cached?.wow?.enabled);
        if (changed) { sessionStorage.removeItem(cacheKey(slug)); location.reload(); return; }
        storeMemory(slug, fresh);
      }).catch(() => {});
      return;
    }
    const data = await publicMemory(slug);
    storeMemory(slug, data);
    render(data);
  } catch (e) {
    console.warn("memory unavailable", e?.message || e);
    showError(e);
  }
}

load();
