// LAMSA order wizard (v38). Mobile-first, 12 short steps, autosaved draft.
import { loadPublicConfig, apiPost } from "../lib/api.js";
import { buildCatalog, money, mb, packageFeatures } from "../lib/catalog.js";
import { esc, $, $$, toast, watchNetwork } from "../lib/ui.js";
import { GAME_BY_KEY, availableGames, emptyGameData, emptyItem, validateGame, buildGamesPayload, questionCount } from "../games/registry.js";
import { loadState, saveState, flushState, putFile, getFile, deleteFile, clearDraft } from "./draft-store.js";
import { prepareImage, checkFile } from "./media.js";
import { submitOrder, abortOrder } from "./submit.js";
import { track, getAttribution } from "../lib/marketing.js";
let icSent = false;

const LEGAL_VERSION = window.LAMSA_CONFIG?.LEGAL_VERSION || "2026-09-11";
const STEPS = ["occasion", "people", "package", "look", "media", "story", "games", "answers", "surprises", "delivery", "review", "send"];
const STEP_LABELS = ["المناسبة", "الأسماء", "الباقة", "الشكل", "الصور", "القصة", "الألعاب", "الإجابات", "المفاجآت", "التوصيل", "المراجعة", "الإرسال"];
const OCCASIONS = [["birthday", "عيد ميلاد"], ["anniversary", "ذكرى ارتباط / جواز"], ["engagement", "خطوبة"], ["valentine", "عيد الحب"], ["apology", "اعتذار"], ["mothers_day", "عيد الأم"], ["graduation", "نجاح / تخرج"], ["baby", "مولود جديد"], ["just_because", "من غير مناسبة"], ["other", "مناسبة تانية"]];
const RELATIONS = [["partner", "حبيبي / حبيبتي"], ["spouse", "زوجي / زوجتي"], ["fiance", "خطيبي / خطيبتي"], ["friend", "صديق / صديقة"], ["mother", "ماما"], ["father", "بابا"], ["sibling", "أخويا / أختي"], ["other", "حد تاني"]];
const THEMES = [["black_rose", "أسود × وردي", "رومانسي وناعم", "t-rose"], ["black_gold", "ذهبي × أسود", "فخم وكلاسيك", "t-gold"], ["elegant_cream", "كلاسيك دافئ", "كريمي هادئ", "t-cream"], ["birthday_balloons", "بالونات", "احتفالي ومبهج", "t-balloons"]];
const STORY_Q = [["firstMeet", "اتقابلتوا أول مرة فين؟", "في الجامعة / عند أصحابنا…"], ["firstMessage", "أول رسالة بينكم كانت إيه؟", "فاكر أول كلمة؟"], ["favoritePlace", "مكانكم المفضل؟", "كافيه، شارع، مدينة…"], ["funny", "موقف مضحك ما بيتنسيش", ""], ["song", "أغنيتكم المشتركة", ""], ["habit", "عادة أو حركة بيعملها/بتعملها", ""], ["secret", "تفصيلة محدش يعرفها غيركم", "كلمة سر، إفيه، اسم دلع…"], ["milestones", "أهم أحداث في علاقتكم", "سطر لكل حدث مع التاريخ"]];
const OCCASION_THEME = { birthday: "birthday_balloons", mothers_day: "elegant_cream", graduation: "black_gold", baby: "elegant_cream" };
const OCCASION_PACK = { engagement: "engagement", mothers_day: "mothers_day", apology: "apology", baby: "baby" };

const fresh = () => ({ v: 1, step: 0, furthest: 0, requestId: crypto.randomUUID(), occasion: "", occasionCustom: "", relationship: "", senderName: "", recipientName: "", recipientGender: "", memoryDate: "", package: "", theme: "black_rose", pageTitle: "", layoutStyle: "carousel", pageEffect: "none", fontSize: "normal", pageTextColor: "default", images: [], cover: null, background: null, video: null, audio: null, songTitle: "", songUrl: "", message: "", closingText: "", story: {}, games: [], pack: "", addons: [], simpleMode: false, textColor: "gold", engraving: "", zone: "", city: "", area: "", street: "", phone: "", deliveryDate: "", paymentMethod: "instapay", notes: "", whatsapp: true, legal: false, attempt: null, honeypot: "" });

let S = fresh(), C = buildCatalog({}), catalogReady = false, submitting = false, gameFilter = "الكل", turnstileToken = "";
const urls = new Map(); // file id -> object URL

/* ---------------- state helpers ---------------- */
const get = (path, o = S) => path.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
function set(path, value) { const ks = path.split("."); let o = S; for (const k of ks.slice(0, -1)) o = o[k] ??= {}; o[ks.at(-1)] = value; persist(); }
function persist() { saveState(S, ok => { const el = $("#savedState"); if (el) el.textContent = ok ? "✓ المسودة محفوظة" : ""; }); }
const pkg = () => C.pkg(S.package);
const occasionLabel = () => S.occasion === "other" ? S.occasionCustom.trim() : (OCCASIONS.find(o => o[0] === S.occasion)?.[1] || "");
const maxGames = () => Math.min(3, (pkg()?.maxGames || 0) + (S.addons.includes("extra_game") && C.addon("extra_game") ? 1 : 0));
const gameCtx = () => ({ senderName: S.senderName.trim(), recipientName: S.recipientName.trim(), imageCount: S.images.length, imageRef: id => { const i = S.images.findIndex(x => x.id === id); return i < 0 ? null : i; } });
async function urlFor(id) { if (!id) return ""; if (urls.has(id)) return urls.get(id); const b = await getFile(id); if (!b) return ""; const u = URL.createObjectURL(b); urls.set(id, u); return u; }

/* ---------------- validation ---------------- */
function validateStep(name) {
  const e = {}, p = pkg();
  if (name === "occasion") { if (!S.occasion) e.occasion = "اختار المناسبة"; else if (S.occasion === "other" && S.occasionCustom.trim().length < 2) e.occasion = "اكتب المناسبة"; if (!S.relationship) e.relationship = "اختار مين المستلم"; }
  if (name === "people") { if (S.senderName.trim().length < 2) e.senderName = "اكتب اسمك"; if (S.recipientName.trim().length < 2) e.recipientName = "اكتب اسم المستلم"; if (!["m", "f"].includes(S.recipientGender)) e.recipientGender = "اختار هو أو هي عشان نكتب الكلام صح"; }
  if (name === "package") { if (!p) e.package = catalogReady ? "اختار باقة" : "استنى تحميل الباقات أو جرّب تحديث الصفحة"; }
  if (name === "media") {
    if (!S.images.length) e.images = "أضف صورة واحدة على الأقل";
    else if (p && S.images.length > p.maxImages) e.images = `الباقة دي تسمح بـ ${p.maxImages} صور. احذف ${S.images.length - p.maxImages} أو غيّر الباقة.`;
    if (p && S.video && !p.allowVideo) e.media = "الفيديو مش متاح في الباقة دي — احذفه أو غيّر الباقة";
    if (p && S.audio && !p.allowAudio) e.media = "الرسالة الصوتية مش متاحة في الباقة دي";
    if (S.songUrl.trim()) { try { const u = new URL(S.songUrl.trim()); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { e.songUrl = "الرابط لازم يبدأ بـ https://"; } }
  }
  if (name === "story") { if (S.message.trim().length < 10) e.message = "اكتب رسالة قصيرة على الأقل (10 حروف)"; }
  if (name === "games") { if (S.games.length > maxGames()) e.games = `مسموح ${maxGames()} ألعاب في اختيارك الحالي. شيل لعبة أو أضف «لعبة إضافية».`; }
  if (name === "answers") { const ctx = gameCtx(); for (const g of S.games) { const errs = validateGame(GAME_BY_KEY.get(g.key), g.data, ctx); if (errs.length) e[`game:${g.key}`] = errs; } }
  if (name === "surprises") { const t = S.games.find(g => GAME_BY_KEY.get(g.key)?.addon); if (t && !S.addons.includes("hunt_stickers")) e.games = "أنت مختار «صيد الكنز» — فعّل إضافة الستيكرات أو شيل اللعبة."; if (S.games.length > maxGames()) e.games = `عدد الألعاب أكبر من المسموح (${maxGames()}).`; }
  if (name === "delivery") { if (!S.zone) e.zone = "اختار منطقة الشحن"; if (S.city.trim().length < 2) e.city = "اكتب المدينة"; if (S.area.trim().length < 2) e.area = "اكتب المنطقة"; if (S.street.trim().length < 5) e.street = "اكتب العنوان بالتفصيل"; if (!/^[+\d ()-]{7,24}$/.test(S.phone.trim()) || S.phone.replace(/\D/g, "").length < 10) e.phone = "اكتب رقم موبايل صحيح"; }
  if (name === "review") { if (!S.legal) e.legal = "لازم توافق على الشروط وسياسة الخصوصية"; }
  return e;
}
function showErrors(name, errors) {
  const sec = $(`[data-step="${name}"]`);
  $$("[data-err]", sec).forEach(el => { el.textContent = ""; });
  $$("[aria-invalid]", sec).forEach(el => el.removeAttribute("aria-invalid"));
  $$(".ow-game-err", sec).forEach(el => el.remove());
  let first = null;
  for (const [k, msg] of Object.entries(errors)) {
    if (k.startsWith("game:")) {
      const box = $(`[data-editor="${k.slice(5)}"]`, sec); if (!box) continue;
      for (const err of msg) {
        const target = err.path.startsWith("items.") ? $(`[data-item="${err.path.split(".")[1]}"]`, box) : box.querySelector(".ow-ed-head");
        target?.insertAdjacentHTML(err.path.startsWith("items.") ? "beforeend" : "afterend", `<p class="l-error ow-game-err">${esc(err.message)}</p>`);
        first ??= target;
      }
      continue;
    }
    const el = $(`[data-err="${k}"]`, sec); if (el) el.textContent = msg;
    const input = $(`[data-k="${k}"]`, sec); input?.setAttribute("aria-invalid", "true");
    first ??= input || el;
  }
  if (first) { first.scrollIntoView({ behavior: "smooth", block: "center" }); (first.matches?.("input,select,textarea") ? first : first.querySelector?.("input,select,textarea,button"))?.focus({ preventScroll: true }); }
  return !first;
}

/* ---------------- navigation ---------------- */
function go(i, { push = true, focus = true } = {}) {
  i = Math.max(0, Math.min(STEPS.length - 2, i));
  // Never jump past the furthest validated step.
  if (i > S.furthest) i = S.furthest;
  S.step = i; persist();
  if (i >= 1 && !icSent) { icSent = true; track("InitiateCheckout", { currency: "EGP", content_category: "gift" }); }
  STEPS.forEach((n, k) => { const s = $(`[data-step="${n}"]`); s.hidden = k !== i; });
  renderStep(STEPS[i]);
  updateChrome();
  if (push) history.pushState({ step: i }, "", `#${STEPS[i]}`);
  if (focus) { scrollTo({ top: 0, behavior: "smooth" }); $(`[data-step="${STEPS[i]}"] .ow-h`)?.focus?.({ preventScroll: true }); }
}
function next() {
  const name = STEPS[S.step], errors = validateStep(name);
  if (!showErrors(name, errors)) { toast("فيه حاجة محتاجة تكمّلها في الخطوة دي"); return; }
  if (name === "review") return startSubmit();
  S.furthest = Math.max(S.furthest, S.step + 1);
  go(S.step + 1);
}
function prev() { if (S.step > 0) history.back(); else location.href = "/"; }
function updateChrome() {
  const total = STEPS.length, i = S.step, pct = Math.round((i / (total - 1)) * 100);
  $("#progressBar").style.width = `${Math.max(4, pct)}%`;
  $("#stepCount").textContent = `الخطوة ${i + 1} من ${total} · ${STEP_LABELS[i]}`;
  $("#stepPercent").textContent = `${pct}% مكتمل`;
  $("#navStep").textContent = `${i + 1}/${total}`;
  $("#prevBtn").textContent = i === 0 ? "→ الرئيسية" : "→ السابق";
  const nb = $("#nextBtn"); nb.textContent = STEPS[i] === "review" ? "إرسال الطلب ♡" : "التالي ←";
  nb.disabled = submitting;
  $(".ow-nav").hidden = STEPS[i] === "send";
  renderSummary();
}

/* ---------------- binding ---------------- */
function bindInputs() {
  const form = $("#orderForm");
  const read = el => (el.type === "checkbox" ? el.checked : el.value);
  const onInput = ev => {
    const el = ev.target, k = el.dataset.k; if (!k) return;
    if (el.type === "radio" && !el.checked) return;
    set(k, read(el));
    el.removeAttribute("aria-invalid"); const err = $(`[data-err="${k}"]`); if (err) err.textContent = "";
    if (k === "message") $('[data-count="message"]').textContent = String(el.value.length);
    if (["zone", "pack", "simpleMode"].includes(k)) renderSummary();
    if (k === "occasionCustom") renderSummary();
  };
  form.addEventListener("input", onInput); form.addEventListener("change", onInput);
  form.addEventListener("submit", e => { e.preventDefault(); next(); });
}
function fillInputs() {
  $$("[data-k]").forEach(el => {
    const v = get(el.dataset.k);
    if (el.type === "checkbox") el.checked = !!v; else if (el.type === "radio") el.checked = el.value === v; else if (v !== undefined && v !== null) el.value = v;
  });
  $('[data-count="message"]').textContent = String(S.message.length);
}

/* ---------------- step renderers ---------------- */
function renderStep(name) {
  if (name === "occasion") renderChips();
  if (name === "package") renderPackages();
  if (name === "look") renderThemes();
  if (name === "media") renderMedia();
  if (name === "story") renderStory();
  if (name === "games") renderGames();
  if (name === "answers") renderEditors();
  if (name === "surprises") renderSurprises();
  if (name === "delivery") renderZones();
  if (name === "review") renderReview();
}
function chip(group, [v, label], current) { return `<label class="ow-chip"><input type="radio" name="${group}" value="${v}" data-k="${group}" ${current === v ? "checked" : ""}><span>${esc(label)}</span></label>`; }
function renderChips() {
  $("#occasionChips").innerHTML = OCCASIONS.map(o => chip("occasion", o, S.occasion)).join("");
  $("#relationshipChips").innerHTML = RELATIONS.map(o => chip("relationship", o, S.relationship)).join("");
  $("#occasionCustomWrap").hidden = S.occasion !== "other";
  $("#occasionChips").onchange = e => { if (e.target.name === "occasion") S.occasion = e.target.value; $("#occasionCustomWrap").hidden = S.occasion !== "other"; if (OCCASION_THEME[S.occasion] && S.theme === "black_rose") set("theme", OCCASION_THEME[S.occasion]); if (OCCASION_PACK[S.occasion] && !S.pack && C.pack(OCCASION_PACK[S.occasion])) S.packSuggested = OCCASION_PACK[S.occasion]; };
}
function renderPackages() {
  const host = $("#packageList");
  if (!catalogReady) return;
  host.removeAttribute("aria-busy");
  if (!C.packages.length) { host.innerHTML = `<div class="l-alert l-alert-err">تعذر تحميل الباقات. تأكد من الإنترنت وحدّث الصفحة.</div>`; return; }
  host.innerHTML = C.packages.map(p => `<label class="ow-pkg ${p.recommended ? "is-rec" : ""}"><input type="radio" name="package" value="${esc(p.id)}" data-k="package" ${S.package === p.id ? "checked" : ""}>
    ${p.recommended ? '<span class="ow-pkg-badge">ننصح بها</span>' : ""}
    <span class="ow-pkg-name">${esc(p.label)}</span>${p.tagline ? `<span class="ow-pkg-tag">${esc(p.tagline)}</span>` : ""}
    <span class="ow-pkg-price">${money(p.price)}</span>
    <ul>${packageFeatures(p).map(f => `<li>${esc(f)}</li>`).join("")}</ul></label>`).join("");
  host.onchange = e => { if (e.target.name === "package") S.package = e.target.value; trimToPackage(); renderSummary(); };
}
function trimToPackage() {
  const p = pkg(); if (!p) return; const notes = [];
  if (S.images.length > p.maxImages) notes.push(`عندك ${S.images.length} صور والباقة تسمح بـ ${p.maxImages} — هتحتاج تحذف الزيادة في خطوة الصور`);
  if (S.video && !p.allowVideo) notes.push("الفيديو مش متاح في الباقة دي");
  if (S.audio && !p.allowAudio) notes.push("الرسالة الصوتية مش متاحة في الباقة دي");
  if (!p.allowSong && (S.songUrl || S.songTitle)) { S.songUrl = ""; S.songTitle = ""; notes.push("الأغنية مش ضمن الباقة دي"); }
  if (S.games.length > maxGames()) notes.push(`الباقة تسمح بـ ${maxGames()} ألعاب`);
  if (notes.length) toast(notes.join(" · "), 5200);
  persist();
}
function renderThemes() {
  $("#themeList").innerHTML = THEMES.map(([v, l, d, cls]) => `<label class="ow-theme"><input type="radio" name="theme" value="${v}" data-k="theme" ${S.theme === v ? "checked" : ""}><span class="ow-theme-sw ${cls}" aria-hidden="true"><i></i></span><b>${l}</b><small>${d}</small></label>`).join("");
}

/* media */
async function renderMedia() {
  const p = pkg();
  $("#mediaLimits").textContent = p ? `باقة ${p.label}: حتى ${p.maxImages} صور${p.allowVideo ? ` + فيديو حتى ${mb(p.maxVideoBytes)}MB` : ""}${p.allowAudio ? ` + رسالة صوتية حتى ${mb(p.maxAudioBytes)}MB` : ""}. رتّب الصور زي ما تحب تظهر.` : "ارفع الصور بالترتيب اللي تحب يظهر بيه.";
  $("#imageHint").textContent = `${S.images.length} من ${p?.maxImages ?? "—"} · الصور الكبيرة بتتضغط تلقائيًا بجودة عالية`;
  const list = $("#imageList");
  list.innerHTML = S.images.map((im, i) => `<li class="ow-thumb" data-id="${im.id}"><img alt="صورة ${i + 1}" width="${im.w || 120}" height="${im.h || 120}" data-src="${im.id}"><span class="ow-thumb-no">${i + 1}</span>
    <div class="ow-thumb-act"><button type="button" data-move="-1" aria-label="قدّم الصورة ${i + 1}" ${i === 0 ? "disabled" : ""}>→</button><button type="button" data-move="1" aria-label="أخّر الصورة ${i + 1}" ${i === S.images.length - 1 ? "disabled" : ""}>←</button><button type="button" data-del aria-label="احذف الصورة ${i + 1}">✕</button></div></li>`).join("");
  for (const img of $$("img[data-src]", list)) img.src = await urlFor(img.dataset.src) || "/assets/img/monogram.svg";
  for (const slot of ["cover", "background", "video", "audio"]) {
    const box = $(`[data-slot="${slot}"]`), item = S[slot], body = $(".ow-slot-body", box);
    if (slot === "video" || slot === "audio") { const ok = slot === "video" ? p?.allowVideo : p?.allowAudio; box.classList.toggle("is-off", !ok); $("[data-hint]", box).textContent = ok ? `حتى ${mb(slot === "video" ? p.maxVideoBytes : p.maxAudioBytes)}MB` : "متاح في باقة أعلى"; $("input", box).disabled = !ok; }
    body.innerHTML = item ? `<div class="ow-slot-file">${slot === "cover" || slot === "background" ? `<img alt="" data-src="${item.id}">` : `<span>${slot === "video" ? "▶" : "♪"}</span>`}<small>${esc(item.name)} · ${(item.size / 1048576).toFixed(1)}MB</small><button type="button" class="l-link" data-clear="${slot}">حذف</button></div>` : "";
    const im = $("img[data-src]", body); if (im) im.src = await urlFor(item.id);
  }
  $("#songFields").hidden = !p?.allowSong;
}
async function addImages(files) {
  const p = pkg(); const room = (p?.maxImages ?? 12) - S.images.length;
  if (room <= 0) { toast(`وصلت للحد الأقصى (${p?.maxImages}) — احذف صورة أو غيّر الباقة`); return; }
  const pick = [...files].slice(0, room), skipped = files.length - pick.length, bad = [];
  $("#imageHint").textContent = "جاري تجهيز الصور…";
  let compressed = 0;
  for (const f of pick) {
    try { const r = await prepareImage(f, p?.maxImageBytes); const id = crypto.randomUUID(); await putFile(id, r.file); S.images.push({ id, name: r.file.name, type: r.file.type, size: r.file.size, w: r.w, h: r.h }); if (r.compressed) compressed++; }
    catch (e) { bad.push(`${f.name}: ${e.message}`); }
  }
  persist(); renderMedia(); renderSummary();
  const msg = [compressed ? `تم ضغط ${compressed} صورة بجودة عالية` : "", skipped > 0 ? `اتجاهلنا ${skipped} صورة لأنها أكتر من حد الباقة` : "", bad.length ? `صور مرفوضة: ${bad.slice(0, 2).join(" · ")}` : ""].filter(Boolean).join(" · ");
  if (msg) toast(msg, 5000);
}
async function setSlot(slot, file) {
  const p = pkg();
  try {
    let blob = file, w = 0, h = 0;
    if (slot === "cover" || slot === "background") { const r = await prepareImage(file, slot === "cover" ? 3 * 1048576 : 5 * 1048576); blob = r.file; w = r.w; h = r.h; }
    else { const err = checkFile(slot, file, p); if (err) throw new Error(err); }
    if (S[slot]) { await deleteFile(S[slot].id); urls.delete(S[slot].id); }
    const id = crypto.randomUUID(); await putFile(id, blob);
    S[slot] = { id, name: blob.name || file.name, type: blob.type, size: blob.size, w, h }; persist(); renderMedia(); renderSummary();
  } catch (e) { $('[data-err="media"]').textContent = e.message; }
}
function bindMedia() {
  $("#imageInput").addEventListener("change", e => { addImages(e.target.files); e.target.value = ""; });
  for (const slot of ["cover", "background", "video", "audio"]) $(`#${slot}Input`).addEventListener("change", e => { if (e.target.files[0]) setSlot(slot, e.target.files[0]); e.target.value = ""; });
  const drop = $("#imageDrop");
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("is-over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("is-over"); addImages([...e.dataTransfer.files].filter(f => f.type.startsWith("image/"))); });
  $("[data-step='media']").addEventListener("click", async e => {
    const li = e.target.closest(".ow-thumb");
    if (li && e.target.closest("[data-move]")) { const i = S.images.findIndex(x => x.id === li.dataset.id), j = i + Number(e.target.closest("[data-move]").dataset.move); [S.images[i], S.images[j]] = [S.images[j], S.images[i]]; persist(); await renderMedia(); $(`.ow-thumb[data-id="${li.dataset.id}"] [data-move]`)?.focus(); }
    if (li && e.target.closest("[data-del]")) { const id = li.dataset.id; S.images = S.images.filter(x => x.id !== id); await deleteFile(id); urls.delete(id); for (const g of S.games) scrubImageRefs(g.data, id); persist(); renderMedia(); renderSummary(); toast("اتحذفت الصورة"); }
    const clr = e.target.closest("[data-clear]"); if (clr) { const slot = clr.dataset.clear; await deleteFile(S[slot].id); S[slot] = null; persist(); renderMedia(); renderSummary(); }
  });
}
function scrubImageRefs(data, id) { if (!data) return; for (const [k, v] of Object.entries(data)) { if (v === id) data[k] = ""; else if (Array.isArray(v)) v.forEach(x => scrubImageRefs(x, id)); } }

/* story */
function renderStory() {
  const host = $("#storyQuestions"); if (host.childElementCount) return;
  host.innerHTML = STORY_Q.map(([k, l, ph]) => `<div class="l-field ${k === "milestones" ? "ow-span" : ""}"><label for="sq-${k}">${l}</label>${k === "milestones" ? `<textarea class="l-textarea" id="sq-${k}" data-k="story.${k}" maxlength="600" rows="3" placeholder="${esc(ph)}"></textarea>` : `<input class="l-input" id="sq-${k}" data-k="story.${k}" maxlength="200" placeholder="${esc(ph)}">`}</div>`).join("");
  fillInputs();
}

/* games */
function suggestedKeys() {
  const s = S.story || {}, out = new Set();
  if (s.habit || s.funny) out.add("who_of_us");
  if (s.milestones || s.firstMeet) out.add("order_story");
  if (s.secret) out.add("scramble");
  if (s.firstMessage || s.favoritePlace) out.add("guess_answer");
  if (["partner", "spouse", "fiance"].includes(S.relationship)) out.add("open_when");
  return out;
}
function renderGames() {
  const list = availableGames(C.games, S.package), sugg = suggestedKeys(), max = maxGames();
  $("#gamesAllowance").textContent = max ? `باقتك تشمل حتى ${max === 1 ? "لعبة واحدة" : `${max} ألعاب`} (اخترت ${S.games.length}).` : (C.addon("extra_game") ? `باقتك لا تشمل ألعاب — تقدر تضيف لعبة بـ ${money(C.addon("extra_game").price)} أو تختار باقة أعلى.` : "باقتك لا تشمل ألعاب. تقدر تختار باقة أعلى أو تكمل بدون ألعاب.");
  const cats = ["الكل", ...new Set(list.map(g => g.category))];
  $("#gameFilter").innerHTML = cats.map(c => `<button type="button" class="ow-filter ${c === gameFilter ? "is-on" : ""}" aria-pressed="${c === gameFilter}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  const ctx = gameCtx();
  const shown = list.filter(g => gameFilter === "الكل" || g.category === gameFilter).sort((a, b) => Number(sugg.has(b.key)) - Number(sugg.has(a.key)));
  $("#gameList").innerHTML = shown.map(g => {
    const sel = S.games.find(x => x.key === g.key), ready = sel && !validateGame(g, sel.data, ctx).length;
    const imgShort = g.needsImages && S.images.length < g.needsImages, addonPrice = g.addon ? C.addon(g.addon) : null;
    const canExtend = S.games.length < 3 && C.addon("extra_game") && !S.addons.includes("extra_game"), full = !sel && S.games.length >= max && !canExtend, extend = !sel && S.games.length >= max && canExtend, unavailable = (g.addon && !addonPrice);
    return `<article class="ow-game ${sel ? "is-sel" : ""}" data-game="${g.key}">
      <div class="ow-game-prev" aria-hidden="true"><span>${esc(g.icon)}</span></div>
      <div class="ow-game-body"><h3>${esc(g.label)} ${sugg.has(g.key) ? '<span class="l-chip l-chip-gold">مقترحة من قصتك</span>' : ""}</h3><p>${esc(g.short)}</p>
      <ul class="ow-game-meta"><li>${esc(questionCount(g))}</li><li>${g.minutes ? `حوالي ${g.minutes} دقايق` : "جاهزة فورًا"}</li>${g.needsImages ? `<li>${imgShort ? "⚠ " : ""}محتاجة ${g.needsImages} صور</li>` : ""}${addonPrice ? `<li>تحتاج إضافة ${money(addonPrice.price)}</li>` : ""}</ul>
      ${sel ? `<p class="ow-game-state ${ready ? "is-ready" : ""}">${ready ? "✓ تم تجهيز بيانات اللعبة" : "✎ محتاجة إجاباتك في الخطوة الجاية"}</p>` : ""}</div>
      <button type="button" class="l-btn ${sel ? "l-btn-ghost" : "l-btn-soft"} l-btn-sm" data-toggle="${g.key}" ${(!sel && (full || unavailable)) ? "disabled" : ""} aria-pressed="${!!sel}">${sel ? "إزالة" : unavailable ? "غير متاحة" : full ? "وصلت للحد" : extend ? `إضافة (+${money(C.addon("extra_game").price)})` : "إضافة"}</button>
    </article>`;
  }).join("") || `<p class="l-help">مفيش ألعاب في التصنيف ده.</p>`;
}
function bindGames() {
  $("#gameFilter").addEventListener("click", e => { const b = e.target.closest("[data-cat]"); if (b) { gameFilter = b.dataset.cat; renderGames(); } });
  $("#gameList").addEventListener("click", e => {
    const b = e.target.closest("[data-toggle]"); if (!b) return; const key = b.dataset.toggle, i = S.games.findIndex(x => x.key === key);
    if (i >= 0) { S.gameDrafts = { ...(S.gameDrafts || {}), [key]: S.games[i].data }; S.games.splice(i, 1); toast("اتشالت اللعبة — إجاباتها محفوظة لو رجعتلها", 2500); }
    else {
      const def = GAME_BY_KEY.get(key), old = S.gameDrafts?.[key], notes = [];
      if (S.games.length >= maxGames() && C.addon("extra_game") && !S.addons.includes("extra_game")) { S.addons.push("extra_game"); notes.push(`اتضافت «${C.addon("extra_game").label}» (+${money(C.addon("extra_game").price)})`); }
      if (def.addon && C.addon(def.addon) && !S.addons.includes(def.addon)) { S.addons.push(def.addon); notes.push(`اتضافت «${C.addon(def.addon).label}» (+${money(C.addon(def.addon).price)})`); }
      if (S.games.length >= maxGames()) { toast("وصلت للحد الأقصى للألعاب"); return; }
      S.games.push({ key, data: old || emptyGameData(def) });
      if (notes.length) toast(notes.join(" · ") + " — تقدر تشيلها من خطوة المفاجآت", 5200);
    }
    persist(); renderGames(); renderSummary(); $(`[data-toggle="${key}"]`)?.focus();
  });
}

/* editors */
function fieldHtml(f, value, path, key) {
  const id = `g-${key}-${path.replace(/\./g, "-")}`, label = `<label for="${id}">${esc(f.label)}${f.optional ? ' <span class="l-opt">(اختياري)</span>' : ""}</label>`, attrs = `id="${id}" data-g="${key}" data-gpath="${path}"`;
  const v = value ?? "";
  if (f.type === "textarea") return `<div class="l-field">${label}<textarea class="l-textarea" rows="3" maxlength="${f.max || 600}" ${attrs} placeholder="${f.placeholder ? esc("مثال: " + f.placeholder) : ""}">${esc(v)}</textarea>${f.help ? `<p class="l-help">${esc(f.help)}</p>` : ""}</div>`;
  if (f.type === "select") return `<div class="l-field">${label}<select class="l-select" ${attrs}><option value="">اختار…</option>${f.options.map(([ov, ol]) => `<option value="${ov}" ${String(v) === ov ? "selected" : ""}>${esc(ol)}</option>`).join("")}</select></div>`;
  if (f.type === "date") return `<div class="l-field">${label}<input type="date" class="l-input" ${attrs} value="${esc(v)}"></div>`;
  if (f.type === "toggle") return `<label class="l-checkline ow-toggle"><input type="checkbox" ${attrs} ${value !== false ? "checked" : ""}><span>${esc(f.label)}</span></label>`;
  if (f.type === "who") { const opts = [["sender", S.senderName || "أنا"], ["recipient", S.recipientName || "الطرف التاني"], ["both", "إحنا الاتنين"]]; return `<fieldset class="ow-who"><legend class="l-label">${esc(f.label)}</legend>${opts.map(([ov, ol]) => `<label class="ow-chip"><input type="radio" name="${id}" value="${ov}" data-g="${key}" data-gpath="${path}" ${v === ov ? "checked" : ""}><span>${esc(ol)}</span></label>`).join("")}</fieldset>`; }
  if (f.type === "image") return `<fieldset class="ow-imgpick"><legend class="l-label">${esc(f.label)}${f.optional ? ' <span class="l-opt">(اختياري)</span>' : ""}</legend>${S.images.length ? `<div class="ow-imgpick-row">${f.optional ? `<label class="ow-imgopt"><input type="radio" name="${id}" value="" data-g="${key}" data-gpath="${path}" ${!v ? "checked" : ""}><span class="ow-imgopt-none">بدون</span></label>` : ""}${S.images.map((im, i) => `<label class="ow-imgopt"><input type="radio" name="${id}" value="${im.id}" data-g="${key}" data-gpath="${path}" ${v === im.id ? "checked" : ""}><img alt="صورة ${i + 1}" data-src="${im.id}" width="56" height="56"></label>`).join("")}</div>` : `<p class="l-help">ارفع صور الأول في خطوة الصور.</p>`}</fieldset>`;
  if (f.type === "chat") return `<div class="l-field"><label for="${id}">${esc(f.label)}</label><input type="file" accept=".txt,text/plain" id="${id}" data-chat="${key}" class="l-input"><p class="l-help" data-chat-status="${key}">${value?.stats ? `✓ تم التحليل: ${Number(value.stats.totalMessages).toLocaleString("ar-EG-u-nu-latn")} رسالة` : "صدّر الشات من واتساب «بدون وسائط» وارفع ملف TXT. النص نفسه لا يُحفظ — الإحصائيات فقط."}</p></div>`;
  return `<div class="l-field">${label}<input class="l-input" maxlength="${f.max || 200}" ${attrs} value="${esc(v)}" placeholder="${f.placeholder ? esc("مثال: " + f.placeholder) : ""}"></div>`;
}
async function renderEditors() {
  const host = $("#gameEditors");
  if (!S.games.length) { host.innerHTML = `<div class="l-alert l-alert-info">ما اخترتش ألعاب — تمام كده، الذكرى هتكون صور ورسالة وقصة. تقدر ترجع تختار لعبة في أي وقت.</div>`; return; }
  host.innerHTML = S.games.map(({ key, data }) => {
    const def = GAME_BY_KEY.get(key); if (!def) return "";
    const items = def.item ? `<ol class="ow-items">${(data.items || []).map((it, i) => `<li class="ow-item" data-item="${i}"><div class="ow-item-head"><b>${esc(def.unit)} ${i + 1}</b>${(data.items.length > (def.min || 1)) ? `<button type="button" class="l-link" data-remove-item="${key}:${i}">حذف</button>` : ""}</div>${def.item.map(f => fieldHtml(f, it[f.name], `items.${i}.${f.name}`, key)).join("")}</li>`).join("")}</ol>${(data.items || []).length < def.max ? `<button type="button" class="l-btn l-btn-soft l-btn-sm" data-add-item="${key}">＋ أضف ${esc(def.unit)}</button>` : ""}` : "";
    return `<section class="ow-editor l-card" data-editor="${key}"><div class="ow-ed-head"><span aria-hidden="true">${esc(def.icon)}</span><div><h3>${esc(def.label)}</h3><p>${esc(def.help || def.short)}</p></div></div>${items}${(def.fields || []).map(f => fieldHtml(f, f.type === "chat" ? data : data[f.name], f.name, key)).join("")}</section>`;
  }).join("");
  for (const img of $$("img[data-src]", host)) img.src = await urlFor(img.dataset.src);
}
function bindEditors() {
  const host = $("#gameEditors");
  const onInput = e => {
    const el = e.target, key = el.dataset.g; if (!key) return; const g = S.games.find(x => x.key === key); if (!g) return;
    if (el.type === "radio" && !el.checked) return;
    const ks = el.dataset.gpath.split("."); let o = g.data; for (const k of ks.slice(0, -1)) o = o[k] ??= {};
    o[ks.at(-1)] = el.type === "checkbox" ? el.checked : el.value;
    S.gameDrafts = { ...(S.gameDrafts || {}), [key]: g.data }; persist();
    el.closest(".ow-item,.ow-editor")?.querySelectorAll(":scope > .ow-game-err").forEach(x => x.remove());
  };
  host.addEventListener("input", onInput); host.addEventListener("change", onInput);
  host.addEventListener("click", e => {
    const add = e.target.closest("[data-add-item]"), rm = e.target.closest("[data-remove-item]");
    if (add) { const g = S.games.find(x => x.key === add.dataset.addItem); g.data.items.push(emptyItem(GAME_BY_KEY.get(g.key))); persist(); renderEditors().then(() => $(`[data-editor="${g.key}"] .ow-item:last-child input`)?.focus()); }
    if (rm) { const [key, i] = rm.dataset.removeItem.split(":"); const g = S.games.find(x => x.key === key); g.data.items.splice(Number(i), 1); persist(); renderEditors(); }
  });
  host.addEventListener("change", async e => {
    const input = e.target.closest("[data-chat]"); if (!input) return; const key = input.dataset.chat, g = S.games.find(x => x.key === key), status = $(`[data-chat-status="${key}"]`), file = input.files?.[0];
    if (!file) return; if (!/\.txt$/i.test(file.name) || file.size > 2 * 1048576) { status.textContent = "اختار ملف TXT حجمه أقل من 2MB"; return; }
    status.textContent = "جاري التحليل الآمن…";
    try { const d = await apiPost("wow-love-wrapped", { text: await file.text() }, { timeoutMs: 40_000 }); g.data.stats = d.stats; persist(); status.textContent = `✓ تم التحليل: ${Number(d.stats.totalMessages).toLocaleString("ar-EG-u-nu-latn")} رسالة — النص الأصلي لم يُحفظ`; }
    catch (err) { status.textContent = err.message || "تعذر تحليل الملف"; }
  });
}

/* surprises */
function renderSurprises() {
  const host = $("#addonList"), rows = [];
  const extra = C.addon("extra_game"), hunt = C.addon("hunt_stickers");
  if (extra) rows.push(`<label class="l-choice"><input type="checkbox" data-addon="extra_game" ${S.addons.includes("extra_game") ? "checked" : ""}><span><b>${esc(extra.label)} <span class="ow-price">+${money(extra.price)}</span></b><small>لعبة زيادة على اللي في الباقة (بحد أقصى 3 ألعاب).</small></span></label>`);
  if (hunt) rows.push(`<label class="l-choice"><input type="checkbox" data-addon="hunt_stickers" ${S.addons.includes("hunt_stickers") ? "checked" : ""}><span><b>${esc(hunt.label)} <span class="ow-price">+${money(hunt.price)}</span></b><small>ستيكرات حقيقية تتحط في البيت للعبة «صيد الكنز».</small></span></label>`);
  host.innerHTML = rows.join("") || `<p class="l-help">مفيش إضافات متاحة حاليًا.</p>`;
  host.onchange = e => { const a = e.target.dataset.addon; if (!a) return; S.addons = e.target.checked ? [...new Set([...S.addons, a])] : S.addons.filter(x => x !== a); persist(); renderSummary(); };
  const packs = C.packs.filter(p => Number.isFinite(p.price));
  $("#packWrap").hidden = !packs.length;
  $("#pack").innerHTML = `<option value="">بدون</option>` + packs.map(p => `<option value="${esc(p.id)}" ${S.pack === p.id ? "selected" : ""}>${esc(p.label)} (+${money(p.price)})${S.packSuggested === p.id ? " — مناسبة لمناسبتك" : ""}</option>`).join("");
}
function renderZones() {
  const el = $("#zone"); if (!catalogReady) return;
  el.innerHTML = `<option value="">اختار المنطقة</option>` + C.zones.map(z => `<option value="${esc(z.id)}" ${S.zone === z.id ? "selected" : ""}>${esc(z.label)} — ${z.fee === null ? "السعر يتحدد بعد التأكيد" : money(z.fee)}</option>`).join("");
}

/* pricing + summary */
function pricing() {
  const p = pkg(), z = C.zone(S.zone), addons = S.addons.map(a => C.addon(a)).filter(Boolean), pack = S.pack ? C.pack(S.pack) : null;
  const extras = addons.reduce((n, a) => n + a.price, 0) + (pack?.price || 0);
  const total = p?.price != null ? p.price + extras + (z?.fee || 0) : null;
  return { p, z, addons, pack, extras, total, shippingPending: !z || z.fee === null };
}
function renderSummary() {
  const { p, z, addons, pack, total, shippingPending } = pricing();
  const rows = [["المناسبة", occasionLabel() || "—"], ["المستلم", S.recipientName || "—"], ["الباقة", p ? `${p.label} · ${money(p.price)}` : "—"], ["الصور", `${S.images.length}${p ? ` / ${p.maxImages}` : ""}`], ["الألعاب", S.games.length ? S.games.map(g => GAME_BY_KEY.get(g.key)?.label).join("، ") : "بدون"]];
  for (const a of addons) rows.push([a.label, `+${money(a.price)}`]);
  if (pack) rows.push([`باقة ${pack.label}`, `+${money(pack.price)}`]);
  rows.push(["الشحن", z ? (z.fee === null ? "يتحدد بعد التأكيد" : money(z.fee)) : "حسب المنطقة"]);
  $("#summary").innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
  const t = total === null ? "—" : `${money(total)}${shippingPending ? " + الشحن" : ""}`;
  $("#sumTotal").textContent = t; $("#navTotal").textContent = t;
}

/* review */
async function renderReview() {
  const { p, total, shippingPending } = pricing(), ctx = gameCtx(), th = THEMES.find(t => t[0] === S.theme);
  const edit = step => `<button type="button" class="l-link" data-goto="${STEPS.indexOf(step)}">تعديل</button>`;
  const gameRows = S.games.map(g => { const def = GAME_BY_KEY.get(g.key), ok = !validateGame(def, g.data, ctx).length; return `<li>${esc(def.label)} — ${ok ? "✓ جاهزة" : "⚠ ناقصها بيانات"}</li>`; }).join("");
  $("#reviewBody").innerHTML = `
    <section class="ow-rev"><div class="ow-rev-h"><h3>الحكاية</h3>${edit("occasion")}</div><p>${esc(occasionLabel())} · من <b>${esc(S.senderName)}</b> إلى <b>${esc(S.recipientName)}</b>${S.memoryDate ? ` · ${esc(S.memoryDate)}` : ""}</p></section>
    <section class="ow-rev"><div class="ow-rev-h"><h3>الباقة والشكل</h3>${edit("package")}</div><p>${esc(p?.label || "—")} · ${money(p?.price)} · ستايل ${esc(th?.[1] || "")}</p></section>
    <section class="ow-rev"><div class="ow-rev-h"><h3>الصور (${S.images.length})</h3>${edit("media")}</div><div class="ow-rev-imgs">${S.images.map((im, i) => `<img alt="صورة ${i + 1}" data-src="${im.id}" width="64" height="64">`).join("")}</div>${[S.video && "فيديو", S.audio && "رسالة صوتية", S.cover && "غلاف", S.background && "خلفية", S.songUrl && "أغنية"].filter(Boolean).map(x => `<span class="l-chip">${x}</span>`).join(" ")}</section>
    <section class="ow-rev"><div class="ow-rev-h"><h3>الرسالة</h3>${edit("story")}</div><p class="ow-rev-msg">${esc(S.message)}</p></section>
    <section class="ow-rev"><div class="ow-rev-h"><h3>الألعاب</h3>${edit("games")}</div>${gameRows ? `<ul>${gameRows}</ul>` : "<p>بدون ألعاب</p>"}</section>
    <section class="ow-rev"><div class="ow-rev-h"><h3>التوصيل</h3>${edit("delivery")}</div><p>${esc([S.street, S.area, S.city].filter(Boolean).join("، "))} · <span dir="ltr">${esc(S.phone)}</span> · الدفع بإنستاباي</p></section>
    <div class="ow-rev-total"><span>الإجمالي</span><b>${total === null ? "—" : money(total)}${shippingPending ? " + الشحن" : ""}</b></div>`;
  for (const img of $$("img[data-src]", $("#reviewBody"))) img.src = await urlFor(img.dataset.src);
  const coverId = S.cover?.id || S.images[0]?.id, cover = await urlFor(coverId);
  $("#reviewPreview").innerHTML = `<div class="ow-pp ${th?.[3] || ""}"><div class="ow-pp-cover" style="${cover ? `background-image:url('${cover}')` : ""}"></div><small>${esc(occasionLabel())}</small><b>${esc(S.pageTitle || `${S.senderName} ♡ ${S.recipientName}`)}</b><span>ابدأ الرحلة ↓</span></div><p class="l-help">معاينة تقريبية لأول شاشة في الذكرى.</p>`;
  mountTurnstile();
}
async function mountTurnstile() {
  const key = String(window.__lamsaCfg?.turnstileSiteKey || ""); const box = $("#turnstileBox");
  if (!key || box.dataset.ready) return; box.dataset.ready = "1";
  try {
    if (!window.turnstile) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    window.turnstile.render(box, { sitekey: key, language: "ar", callback: t => { turnstileToken = t; }, "expired-callback": () => { turnstileToken = ""; } });
  } catch { box.innerHTML = `<p class="l-help">تعذر تحميل التحقق الأمني — هنحاول الإرسال بدونه.</p>`; }
}

/* ---------------- submission ---------------- */
function mainFiles() { return [...S.images.map(x => ({ ...x, kind: "image" })), ...(S.video ? [{ ...S.video, kind: "video" }] : []), ...(S.audio ? [{ ...S.audio, kind: "audio" }] : [])]; }
const fingerprint = () => mainFiles().map(f => `${f.kind}:${f.size}:${f.type}`).join("|") + `|${S.package}`;
function buildPayload() {
  const p = pkg();
  return {
    requestId: S.attempt.requestId, honeypot: S.honeypot || "", package: S.package, paymentMethod: "instapay", turnstileToken, attribution: getAttribution(),
    customization: {
      senderName: S.senderName.trim(), recipientName: S.recipientName.trim(), occasion: occasionLabel().slice(0, 80), date: S.memoryDate || null, message: S.message.trim(), theme: S.theme,
      pageCopy: { pageTitle: S.pageTitle.trim(), intro: "", messageTitle: "كلمة من القلب", galleryTitle: "لحظاتنا", audioTitle: "صوت من القلب", videoTitle: "لحظات حية", songSectionTitle: "أغنيتنا", closingText: S.closingText.trim() },
      songTitle: p?.allowSong ? S.songTitle.trim() : "", songUrl: p?.allowSong ? S.songUrl.trim() : "",
      acrylic: { textColor: S.textColor, layout: "signature" },
      advanced: { pageTextColor: S.pageTextColor, fontSize: S.simpleMode && S.fontSize === "normal" ? "large" : S.fontSize, layoutStyle: S.layoutStyle, pageEffect: S.pageEffect, logoPosition: "none", engraving: S.engraving.trim() }
    },
    shippingAddress: { street: S.street.trim(), city: S.city.trim(), area: S.area.trim(), zoneId: S.zone, phone: S.phone.trim() },
    requestedDeliveryDate: S.deliveryDate || null, notes: S.notes.trim(), whatsappOptIn: !!S.whatsapp,
    consent: { accepted: !!S.legal, version: LEGAL_VERSION },
    uploads: mainFiles().map((f, clientIndex) => ({ clientIndex, name: safeName(f.name), kind: f.kind, mimeType: f.type, size: f.size }))
  };
}
function safeName(n) { return String(n || "file").normalize("NFKD").replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(-100) || "file"; }
function storyBuild() {
  const clip = (v, n) => String(v || "").trim().slice(0, n);
  const answers = Object.fromEntries(Object.entries(S.story || {}).map(([k, v]) => [k, clip(v, k === "milestones" ? 600 : 200)]).filter(([, v]) => v));
  answers.occasionType = S.occasion; answers.relationship = S.relationship;
  return { storyAnswers: answers, addons: S.addons.filter(a => C.addon(a)), occasionPack: S.pack || null, simpleMode: !!S.simpleMode, recipientGender: S.recipientGender || null, imageCount: S.images.length };
}
async function startSubmit() {
  if (submitting) return;
  // Re-validate everything; jump to the first broken step.
  for (let i = 0; i < STEPS.indexOf("review"); i++) { const errs = validateStep(STEPS[i]); if (Object.keys(errs).length) { S.furthest = Math.max(S.furthest, i); go(i); setTimeout(() => showErrors(STEPS[i], errs), 50); toast(`راجع خطوة «${STEP_LABELS[i]}»`); return; } }
  if (!navigator.onLine) { toast("أنت غير متصل بالإنترنت. طلبك محفوظ — ابعته أول ما الشبكة ترجع."); return; }
  const fp = fingerprint();
  if (S.attempt && S.attempt.fingerprint !== fp) { if (S.attempt.orderNumber) await abortOrder({ orderNumber: S.attempt.orderNumber, trackingToken: S.attempt.trackingToken }); S.attempt = null; }
  S.attempt ??= { requestId: crypto.randomUUID(), fingerprint: fp };
  flushState(S);
  submitting = true; S.furthest = STEPS.indexOf("send"); S.step = S.furthest;
  STEPS.forEach((n, k) => { $(`[data-step="${n}"]`).hidden = k !== S.step; }); updateChrome(); history.pushState({ step: S.step }, "", "#send"); scrollTo({ top: 0 });
  $("#sendError").hidden = true; $("#sendActions").hidden = true;
  const files = []; for (const f of mainFiles()) { const b = await getFile(f.id); if (!b) { return failSend(new Error(`الملف «${f.name}» مش موجود على الجهاز تاني. ارجع لخطوة الصور وضيفه من جديد.`)); } files.push(b); }
  const special = []; for (const kind of ["cover", "background"]) if (S[kind]) { const b = await getFile(S[kind].id); if (b) special.push({ kind: kind === "cover" ? "logo" : "background", blob: b, name: safeName(S[kind].name) }); }
  $("#sendFiles").innerHTML = mainFiles().map((f, i) => `<li data-f="${i}"><span>${f.kind === "image" ? "صورة" : f.kind === "video" ? "فيديو" : "صوت"} ${i + 1}</span><i></i></li>`).join("");
  const games = buildGamesPayload(S.games, gameCtx()), build = storyBuild();
  const wire = games.length ? games.map((g, i) => (i === 0 ? { ...g, config: { ...g.config, __storyBuild: build } } : g)) : [{ game: "setup", config: { __storyBuild: build } }];
  try {
    const res = await submitOrder({ payload: buildPayload(), files, special, games: wire, onProgress: ({ ratio, label, file }) => {
      const pct = Math.round(ratio * 100); $("#sendBar i").style.width = `${pct}%`; $("#sendBar").setAttribute("aria-valuenow", String(pct)); $("#sendStatus").textContent = label;
      if (file !== undefined) $$("#sendFiles li").forEach((li, k) => li.classList.toggle("is-done", k < file || (k === file && /تم|بالفعل/.test(label))));
    } });
    S.attempt.orderNumber = res.orderNumber; S.attempt.trackingToken = res.trackingToken;
    sessionStorage.setItem("lamsa_track_token", res.trackingToken); sessionStorage.setItem("lamsa_track_order", res.orderNumber);
    sessionStorage.setItem("lamsa_order_whatsapp_status", res.whatsappStatus || "");
    if (res.warnings.length) sessionStorage.setItem("lamsa_special_media_warning", res.warnings.join(" · ")); else sessionStorage.removeItem("lamsa_special_media_warning");
    sessionStorage.setItem("lamsa_wow_games", String(S.games.length));
    sessionStorage.setItem("lamsa_wow_price", String(pricing().extras || 0));
    await clearDraft();
    location.replace(`/order-success.html?order=${encodeURIComponent(res.orderNumber)}`);
  } catch (e) { failSend(e); }
}
function failSend(e) {
  submitting = false; updateChrome(); $(".ow-nav").hidden = true;
  const box = $("#sendError"); box.hidden = false;
  box.innerHTML = `<b>ما قدرناش نكمّل الإرسال.</b><br>${esc(e.message || "حصل خطأ غير متوقع")}<br><small>كل بياناتك وصورك محفوظة على الجهاز. «إعادة المحاولة» بتكمّل نفس الطلب من غير ما يتكرر.</small>`;
  $("#sendActions").hidden = false; $("#sendStatus").textContent = "توقف الإرسال";
  flushState(S); box.focus?.();
}

/* ---------------- boot ---------------- */
async function boot() {
  watchNetwork(); bindInputs(); bindMedia(); bindGames(); bindEditors();
  const saved = loadState();
  if (saved) { S = { ...fresh(), ...saved }; $("#draftBanner").hidden = !(saved.furthest > 0); }
  const qp = new URLSearchParams(location.search);
  if (qp.get("package") && !S.package) S.package = qp.get("package");
  if (qp.get("pack") && !S.pack) S.pack = qp.get("pack");
  if (qp.get("game") && GAME_BY_KEY.has(qp.get("game")) && !S.games.some(g => g.key === qp.get("game"))) S.games.push({ key: qp.get("game"), data: emptyGameData(GAME_BY_KEY.get(qp.get("game"))) });
  if (S.step >= STEPS.indexOf("send")) S.step = STEPS.indexOf("review");
  fillInputs();
  const hashStep = STEPS.indexOf(location.hash.slice(1));
  history.replaceState({ step: S.step }, "", `#${STEPS[S.step]}`);
  go(hashStep >= 0 && hashStep <= S.furthest ? hashStep : S.step, { push: false, focus: false });
  addEventListener("popstate", e => { if (submitting) { history.pushState({ step: S.step }, "", "#send"); toast("استنى لحظة — بنكمّل إرسال طلبك"); return; } const i = Number(e.state?.step); if (Number.isInteger(i)) go(i, { push: false }); });
  addEventListener("beforeunload", e => { flushState(S); if (submitting) { e.preventDefault(); e.returnValue = ""; } });
  addEventListener("pagehide", () => flushState(S));
  $("#nextBtn").onclick = next; $("#prevBtn").onclick = prev;
  $("#retrySend").onclick = () => startSubmit();
  $("#backToReview").onclick = () => { S.furthest = STEPS.indexOf("review"); go(S.furthest); };
  $("#resetDraft").onclick = async () => { if (!confirm("هتمسح المسودة الحالية وتبدأ من الأول؟")) return; if (S.attempt?.orderNumber) await abortOrder({ orderNumber: S.attempt.orderNumber, trackingToken: S.attempt.trackingToken }); await clearDraft(); location.replace("/order.html"); };
  document.addEventListener("click", e => { const g = e.target.closest("[data-goto]"); if (g) go(Number(g.dataset.goto)); if (e.target.closest("[data-reload]")) location.reload(); });
  try {
    const cfg = await loadPublicConfig(); window.__lamsaCfg = cfg; C = buildCatalog(cfg); catalogReady = true;
    if (S.package && !C.pkg(S.package)) S.package = "";
    if (!S.package) S.package = C.packages.find(p => p.recommended)?.id || "";
  } catch (e) {
    catalogReady = true; C = buildCatalog({});
    $("#packageList").innerHTML = `<div class="l-alert l-alert-err">تعذر تحميل الباقات والأسعار: ${esc(e.message)} <button type="button" class="l-link" data-reload>إعادة المحاولة</button></div>`;
  }
  renderStep(STEPS[S.step]); renderSummary();
}
boot();
