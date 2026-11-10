// LAMSA unified game registry.
// One definition per game drives: the picker card in the order wizard, the
// answer editor (fields), validation, the server config sent to
// `order-wow-selection`, and the homepage demos. To add a new game, add one
// entry here (+ a memory-page module under assets/js/wow/legacy/moments when it
// needs a new renderer). The order page never needs to be rebuilt.
//
// Field types: text | textarea | select | who | image | toggle | date
// `wire` is the key understood by the Edge Function / memory modules.

const clip = (v, n) => String(v ?? "").trim().slice(0, n);
const nonEmpty = a => (a || []).filter(x => x && Object.values(x).some(v => String(v ?? "").trim()));

/** Deterministic shuffle so a saved draft always produces the same config. */
function seededOrder(n, seed) {
  const idx = [...Array(n).keys()]; let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  for (let i = n - 1; i > 0; i--) { s = (s * 1103515245 + 12345) >>> 0; const j = s % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

/** Shared optional reward field: the message shown after the recipient wins. */
const REWARD_FIELD = { name: "reward", label: "رسالة المفاجأة بعد الفوز", type: "textarea", max: 600, optional: true, help: "تظهر فقط بعد ما المستلم يخلص اللعبة." };
const reward = d => (clip(d.reward, 600) ? { type: "message", text: clip(d.reward, 600) } : { type: "none", text: "" });
const base = (def, d) => ({ title: def.label, skippable: true, playOnce: true, reward: reward(d) });

export const GAMES = [
  {
    key: "who_of_us", wire: "quiz", label: "مين فينا؟", icon: "♡", minutes: 3, category: "أسئلة",
    short: "أسئلة عنكم، والمستلم يختار: أنا ولا إنت ولا إحنا الاتنين.",
    unit: "سؤال", min: 2, max: 5,
    item: [
      { name: "q", label: "السؤال", type: "text", max: 200, placeholder: "مين فينا اللي بيتأخر أكتر؟" },
      { name: "who", label: "الإجابة الصحيحة", type: "who" },
      { name: "comment", label: "تعليق يظهر بعد الإجابة", type: "text", max: 160, optional: true, placeholder: "ولسه بتتأخر لحد النهارده 😄" }
    ],
    fields: [REWARD_FIELD],
    validateItem: it => (!clip(it.q, 200) ? "اكتب السؤال" : !["sender", "recipient", "both"].includes(it.who) ? "اختار الإجابة الصحيحة" : ""),
    build(d, ctx) {
      const options = [ctx.senderName || "أنا", ctx.recipientName || "الطرف التاني", "إحنا الاتنين"];
      const map = { sender: 0, recipient: 1, both: 2 };
      return { ...base(this, d), questions: nonEmpty(d.items).map(it => { const answer = map[it.who] ?? 0, c = clip(it.comment, 160); return { q: clip(it.q, 300), options, answer, reactions: options.map((_, i) => i === answer ? (c ? `صح ♡ ${c}` : "صح ♡") : (c ? `قريب… ${c}` : "مش دي 😄")) }; }), perfect: "إنت حافظ تفاصيلنا كلها ♡", good: "قريب جدًا 😌", bad: "محتاجين نقعد نحكي تاني 😂" };
    }
  },
  {
    key: "guess_answer", wire: "finish_sentence", label: "خمّن إجابتي", icon: "?", minutes: 4, category: "أسئلة",
    short: "سؤال وإجابة صحيحة واختيارات غلط، ورسالة تظهر بعد الإجابة.",
    unit: "سؤال", min: 1, max: 5,
    item: [
      { name: "q", label: "السؤال", type: "text", max: 200, placeholder: "أكتر أكلة بحبها من إيدك؟" },
      { name: "correct", label: "الإجابة الصحيحة", type: "text", max: 120 },
      { name: "wrong1", label: "اختيار غلط", type: "text", max: 120 },
      { name: "wrong2", label: "اختيار غلط تاني", type: "text", max: 120, optional: true },
      { name: "message", label: "رسالة بعد الإجابة", type: "text", max: 200, optional: true }
    ],
    fields: [REWARD_FIELD],
    validateItem: it => (!clip(it.q, 200) ? "اكتب السؤال" : !clip(it.correct, 120) ? "اكتب الإجابة الصحيحة" : !clip(it.wrong1, 120) ? "اكتب اختيار غلط واحد على الأقل" : ""),
    build(d) {
      const questions = nonEmpty(d.items).map((it, n) => {
        const opts = [clip(it.correct, 120), clip(it.wrong1, 120), clip(it.wrong2, 120)].filter(Boolean);
        const order = seededOrder(opts.length, `${it.q}|${n}`);
        return { q: clip(it.q, 300), options: order.map(i => opts[i]), answer: order.indexOf(0), message: clip(it.message, 200) };
      });
      // finish_sentence keeps single-question fields for older renderers.
      return { ...base(this, d), questions, prompt: questions[0]?.q || "", options: questions[0]?.options || [], answer: questions[0]?.answer ?? 0 };
    }
  },
  {
    key: "order_story", wire: "order_story", label: "رتّب ذكرياتنا", icon: "↕", minutes: 4, category: "قصة",
    short: "أحداث حكايتكم بالترتيب، والمستلم يرتبها صح عشان تفتح المفاجأة.",
    unit: "حدث", min: 3, max: 6,
    item: [
      { name: "title", label: "اسم الحدث", type: "text", max: 80, placeholder: "أول خروجة" },
      { name: "when", label: "التاريخ أو الوقت", type: "text", max: 40, optional: true, placeholder: "صيف 2023" },
      { name: "image", label: "صورة الحدث", type: "image", optional: true }
    ],
    fields: [{ name: "winText", label: "رسالة عند النجاح", type: "text", max: 200, optional: true, placeholder: "بالظبط كده بدأت حكايتنا ♡" }, REWARD_FIELD],
    help: "اكتب الأحداث بالترتيب الصحيح من الأقدم للأحدث. هنلخبطها للمستلم.",
    validateItem: it => (!clip(it.title, 80) ? "اكتب اسم الحدث" : ""),
    build(d, ctx) {
      const events = nonEmpty(d.items).map(it => ({ title: clip(it.title, 80), when: clip(it.when, 40), imageRef: ctx.imageRef(it.image) }));
      return { ...base(this, d), events, correctOrder: events.map((_, i) => i), winText: clip(d.winText, 200) };
    }
  },
  {
    key: "open_when", wire: "open_when", label: "افتحها عندما…", icon: "✉", minutes: 5, category: "رسائل",
    short: "ظروف مقفولة لأوقات معينة: لما توحشني، لما تزعل، في عيد ميلادك.",
    unit: "ظرف", min: 1, max: 6,
    item: [
      { name: "title", label: "افتحها عندما…", type: "text", max: 60, placeholder: "لما أوحشك" },
      { name: "text", label: "الرسالة", type: "textarea", max: 600 },
      { name: "image", label: "صورة مع الرسالة", type: "image", optional: true },
      { name: "repeat", label: "يقدر يفتحها أكتر من مرة", type: "toggle", default: true }
    ],
    fields: [],
    validateItem: it => (!clip(it.title, 60) ? "اكتب الحالة" : !clip(it.text, 600) ? "اكتب الرسالة" : ""),
    build(d, ctx) { return { title: this.label, skippable: false, playOnce: false, reward: { type: "none", text: "" }, items: nonEmpty(d.items).map(it => ({ title: clip(it.title, 60), text: clip(it.text, 600), imageRef: ctx.imageRef(it.image), once: it.repeat === false })) }; }
  },
  {
    key: "true_false", wire: "true_false", label: "صح ولا غلط", icon: "✓", minutes: 3, category: "أسئلة",
    short: "جمل عن تفاصيلكم، والمستلم يحدد صح ولا غلط.",
    unit: "جملة", min: 2, max: 5,
    item: [
      { name: "text", label: "الجملة", type: "text", max: 160, placeholder: "أول مرة اتقابلنا كانت في الجامعة" },
      { name: "answer", label: "الإجابة", type: "select", options: [["true", "صح"], ["false", "غلط"]] },
      { name: "reaction", label: "تعليق بعد الإجابة", type: "text", max: 120, optional: true }
    ],
    fields: [REWARD_FIELD],
    validateItem: it => (!clip(it.text, 160) ? "اكتب الجملة" : !["true", "false"].includes(String(it.answer)) ? "اختار صح أو غلط" : ""),
    build(d) { return { ...base(this, d), items: nonEmpty(d.items).map(it => ({ text: clip(it.text, 160), answer: String(it.answer) === "true", reaction: clip(it.reaction, 120) })) }; }
  },
  {
    key: "scramble", wire: "scramble", label: "رتّب الكلمة", icon: "ا", minutes: 1, category: "ألعاب سريعة",
    short: "كلمة سر بينكم بحروف ملخبطة.",
    fields: [
      { name: "word", label: "الكلمة (من 3 لـ 12 حرف)", type: "text", max: 12, placeholder: "قهوتنا" },
      { name: "hint", label: "تلميح", type: "text", max: 100, optional: true, placeholder: "مكان أول خروجة" }, REWARD_FIELD
    ],
    validate: d => { const w = clip(d.word, 12).replace(/\s+/g, ""); return w.length < 3 ? "اكتب كلمة من 3 حروف على الأقل بدون مسافات" : ""; },
    build(d) { return { ...base(this, d), word: clip(d.word, 12).replace(/\s+/g, ""), hint: clip(d.hint, 100) }; }
  },
  {
    key: "wheel", wire: "wheel", label: "عجلة الوعد", icon: "◎", minutes: 2, category: "مفاجآت",
    short: "عجلة فيها وعود وخروجات حقيقية، والمستلم يلفها ويكسب واحدة.",
    unit: "اختيار", min: 2, max: 8,
    item: [{ name: "text", label: "الوعد أو الخروجة", type: "text", max: 80, placeholder: "عشا على النيل" }],
    fields: [REWARD_FIELD],
    validateItem: it => (!clip(it.text, 80) ? "اكتب الاختيار" : ""),
    build(d) { return { ...base(this, d), options: nonEmpty(d.items).map(it => clip(it.text, 80)) }; }
  },
  {
    key: "coupons", wire: "coupons", type: "coupons", label: "كوبونات الحب", icon: "✂", minutes: 2, category: "مفاجآت",
    short: "كوبونات وعود يستخدمها المستلم وقت ما يحب.",
    unit: "كوبون", min: 1, max: 8,
    item: [{ name: "title", label: "الكوبون", type: "text", max: 80, placeholder: "يوم كامل من اختيارك" }, { name: "subtitle", label: "تفاصيل", type: "text", max: 140, optional: true }],
    fields: [],
    validateItem: it => (!clip(it.title, 80) ? "اكتب الكوبون" : ""),
    build(d) { return { title: this.label, items: nonEmpty(d.items).map(it => ({ title: clip(it.title, 80), subtitle: clip(it.subtitle, 140) })) }; }
  },
  {
    key: "balloons", wire: "balloons", label: "بلالين المفاجأة", icon: "○", minutes: 2, category: "ألعاب سريعة",
    short: "كل بلونة فيها جملة منك، وآخر بلونة فيها المفاجأة.",
    unit: "جملة", min: 2, max: 8,
    item: [{ name: "text", label: "الجملة", type: "text", max: 120, placeholder: "ضحكتك" }],
    fields: [REWARD_FIELD],
    validateItem: it => (!clip(it.text, 120) ? "اكتب الجملة" : ""),
    build(d) { return { ...base(this, d), lines: nonEmpty(d.items).map(it => clip(it.text, 120)) }; }
  },
  {
    key: "puzzle", wire: "puzzle", label: "بازل الصورة", icon: "▦", minutes: 1, category: "صور", needsImages: 1,
    short: "صورة من صوركم تتحول لبازل، ولما يكمل تظهر المفاجأة.",
    fields: [{ name: "image", label: "اختار صورة البازل", type: "image" }, { name: "size", label: "الصعوبة", type: "select", options: [["3", "متوسطة (3×3)"], ["4", "صعبة (4×4)"], ["2", "سهلة (2×2)"]] }, REWARD_FIELD],
    validate: (d, ctx) => (ctx.imageRef(d.image) === null ? "اختار صورة للبازل" : ""),
    build(d, ctx) { const ref = ctx.imageRef(d.image); return { ...base(this, d), imageRef: ref, imageIndex: ref ?? 0, size: Math.max(2, Math.min(4, Number(d.size || 3))) }; }
  },
  {
    key: "memory", wire: "memory", label: "لعبة الذاكرة", icon: "▣", minutes: 1, category: "صور", needsImages: 4,
    short: "كروت بصوركم، والمستلم يطابق كل صورتين.",
    fields: [REWARD_FIELD],
    build(d) { return { ...base(this, d), autoImages: true }; }
  },
  {
    key: "scratch", wire: "scratch", label: "اكشط المفاجأة", icon: "✦", minutes: 1, category: "مفاجآت",
    short: "المستلم يكشط بصباعه عشان يكشف صورة أو رسالة.",
    fields: [{ name: "text", label: "الرسالة المخفية", type: "text", max: 160, optional: true }, { name: "image", label: "أو صورة مخفية", type: "image", optional: true }, REWARD_FIELD],
    validate: (d, ctx) => (!clip(d.text, 160) && ctx.imageRef(d.image) === null ? "اكتب رسالة أو اختار صورة" : ""),
    build(d, ctx) { return { ...base(this, d), text: clip(d.text, 160), imageRef: ctx.imageRef(d.image) }; }
  },
  {
    key: "story", wire: "story", label: "محطات الحكاية", icon: "↳", minutes: 3, category: "قصة",
    short: "سؤال عن بدايتكم باختيارين، وكل اختيار يفتح ذكرى.",
    fields: [
      { name: "start", label: "السؤال الأول", type: "text", max: 200, placeholder: "فاكر أول مرة اتقابلنا؟" },
      { name: "a", label: "الاختيار الأول", type: "text", max: 80 }, { name: "aEnd", label: "الذكرى اللي تظهر لو اختاره", type: "textarea", max: 400 },
      { name: "b", label: "الاختيار التاني", type: "text", max: 80 }, { name: "bEnd", label: "الذكرى اللي تظهر لو اختاره", type: "textarea", max: 400 }, REWARD_FIELD
    ],
    validate: d => (["start", "a", "aEnd", "b", "bEnd"].some(k => !clip(d[k], 400)) ? "كمّل السؤال والاختيارين والذكريات" : ""),
    build(d) { return { ...base(this, d), nodes: { start: { text: clip(d.start, 200), choices: [{ label: clip(d.a, 80), next: "one" }, { label: clip(d.b, 80), next: "two" }] }, one: { text: clip(d.aEnd, 400), title: clip(d.a, 80), end: true, choices: [] }, two: { text: clip(d.bEnd, 400), title: clip(d.b, 80), end: true, choices: [] } } }; }
  },
  {
    key: "reunion_countdown", wire: "reunion_countdown", label: "ميعاد اللقاء", icon: "⌛", minutes: 1, category: "رسائل",
    short: "عداد تنازلي لميعاد لقائكم الجاي بين مدينتين.",
    fields: [{ name: "cityA", label: "مدينتك", type: "text", max: 40 }, { name: "cityB", label: "مدينته / مدينتها", type: "text", max: 40 }, { name: "meetAt", label: "ميعاد اللقاء", type: "date" }, { name: "message", label: "رسالة", type: "text", max: 200, optional: true }],
    validate: d => (!clip(d.cityA, 40) || !clip(d.cityB, 40) || !d.meetAt ? "اكتب المدينتين والميعاد" : ""),
    build(d) { return { title: this.label, skippable: true, playOnce: false, reward: { type: "none", text: "" }, cityA: clip(d.cityA, 40), cityB: clip(d.cityB, 40), meetAt: clip(d.meetAt, 30), message: clip(d.message, 200) }; }
  },
  {
    key: "love_wrapped", wire: "love_wrapped", label: "Love Wrapped", icon: "≋", minutes: 3, category: "قصة",
    short: "أرقام حقيقية من شات واتساب بينكم: عدد الرسائل وأكتر كلمة وإيموجي.",
    fields: [{ name: "chat", label: "ملف شات واتساب (TXT)", type: "chat" }, REWARD_FIELD],
    validate: d => (!d.stats || Number(d.stats.totalMessages) < 10 ? "ارفع ملف الشات وانتظر التحليل" : ""),
    build(d) { return { ...base(this, d), stats: d.stats }; }
  },
  {
    key: "remote_touch", wire: "remote_touch", label: "لمسة عن بُعد", icon: "☝", minutes: 0, category: "مفاجآت",
    short: "تفتحوا الذكرى من موبايلين وتلمسوا القلب في نفس اللحظة.",
    fields: [REWARD_FIELD], noData: true,
    build(d) { return { ...base(this, d) }; }
  },
  {
    key: "treasure", wire: "treasure", type: "treasure", label: "صيد الكنز", icon: "⌖", minutes: 5, category: "مفاجآت", addon: "hunt_stickers",
    short: "3 ستيكرات حقيقية في البيت، وكل ستيكر يفتح دليل للي بعده.",
    unit: "دليل", min: 2, max: 6,
    item: [{ name: "text", label: "الدليل", type: "text", max: 200 }, { name: "hint", label: "تلميح", type: "text", max: 120, optional: true }],
    fields: [{ name: "finalTitle", label: "عنوان الكنز", type: "text", max: 80, optional: true }, { name: "finalText", label: "رسالة الكنز", type: "textarea", max: 500 }],
    validateItem: it => (!clip(it.text, 200) ? "اكتب الدليل" : ""),
    validate: d => (!clip(d.finalText, 500) ? "اكتب رسالة الكنز" : ""),
    build(d) { return { title: this.label, clues: nonEmpty(d.items).map(it => ({ text: clip(it.text, 200), hint: clip(it.hint, 120) })), finalTitle: clip(d.finalTitle, 80) || "لقيت الكنز!", finalText: clip(d.finalText, 500) }; }
  }
];

export const GAME_BY_KEY = new Map(GAMES.map(g => [g.key, g]));

/** Games visible for sale: respects the admin game_catalog when present. */
export function availableGames(catalogGames, pkgId) {
  if (!Array.isArray(catalogGames) || !catalogGames.length) return GAMES;
  const rows = new Map(catalogGames.map(r => [r.key, r]));
  return GAMES.filter(g => { const r = rows.get(g.key); if (!r) return true; return r.active !== false && (!r.min_package || r.min_package === pkgId || pkgId === "premium"); })
    .map(g => { const r = rows.get(g.key); return r?.label ? { ...g, label: r.label, short: r.description || g.short } : g; });
}

export function emptyGameData(def) {
  const d = {};
  if (def.item) d.items = Array.from({ length: def.min || 1 }, () => emptyItem(def));
  for (const f of def.fields || []) if (f.type === "toggle") d[f.name] = f.default !== false;
  return d;
}
export function emptyItem(def) { const it = {}; for (const f of def.item || []) if (f.type === "toggle") it[f.name] = f.default !== false; return it; }

/** Returns a list of {path, message}; empty = ready. */
export function validateGame(def, data = {}, ctx) {
  const errors = [];
  if (def.needsImages && ctx.imageCount < def.needsImages) errors.push({ path: "", message: `اللعبة دي محتاجة ${def.needsImages} ${def.needsImages === 1 ? "صورة" : "صور"} على الأقل في خطوة الصور` });
  if (def.item) {
    const items = data.items || [];
    const filled = items.map((it, i) => ({ it, i })).filter(({ it }) => Object.entries(it).some(([k, v]) => def.item.find(f => f.name === k)?.type !== "toggle" && String(v ?? "").trim()));
    if (filled.length < def.min) errors.push({ path: "items", message: `محتاج ${def.min} ${def.unit} على الأقل` });
    for (const { it, i } of filled) { const m = def.validateItem?.(it, ctx); if (m) errors.push({ path: `items.${i}`, message: m }); }
  }
  const m = def.validate?.(data, ctx); if (m) errors.push({ path: "", message: m });
  return errors;
}

export function questionCount(def) { return def.item ? `${def.min}–${def.max} ${def.unit}` : def.noData ? "بدون إدخال" : `${(def.fields || []).filter(f => !f.optional && f.type !== "toggle").length || 1} خانة`; }

/** Converts the wizard selection into the payload accepted by order-wow-selection. */
export function buildGamesPayload(selection, ctx) {
  return selection.map(({ key, data }) => {
    const def = GAME_BY_KEY.get(key); if (!def) return null;
    return { game: def.wire, config: { ...def.build(data || {}, ctx), lamsaGame: def.key } };
  }).filter(Boolean);
}
