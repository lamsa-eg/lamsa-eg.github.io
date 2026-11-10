// The order wizard's game payloads must survive the server sanitizer unchanged
// in meaning (real answers kept, unknown fields dropped, invalid data rejected).
import { test } from "node:test";
import assert from "node:assert/strict";
import { GAMES, GAME_BY_KEY, validateGame, buildGamesPayload, emptyGameData } from "../../assets/js/games/registry.js";
import { sanitize, GAME_KEYS } from "../../supabase/functions/_shared/game-sanitize.ts";

const ctx = { senderName: "سارة", recipientName: "يوسف", imageCount: 4, imageRef: id => (id ? ["a", "b", "c", "d"].indexOf(id) : null) };
const SAMPLE = {
  who_of_us: { items: [{ q: "مين بيتأخر؟", who: "recipient", comment: "دايمًا" }, { q: "مين بدأ؟", who: "both" }] },
  guess_answer: { items: [{ q: "أكلتي المفضلة؟", correct: "محشي", wrong1: "كشري", wrong2: "فول", message: "طبعًا" }] },
  order_story: { items: [{ title: "أول رسالة", image: "b" }, { title: "أول خروجة" }, { title: "الخطوبة", when: "2024" }], winText: "برافو" },
  open_when: { items: [{ title: "لما أوحشك", text: "أنا جنبك", image: "c", repeat: false }] },
  true_false: { items: [{ text: "اتقابلنا في الجامعة", answer: "true" }, { text: "أنا بطبخ", answer: "false", reaction: "😂" }] },
  scramble: { word: "قهوتنا", hint: "مكاننا" },
  wheel: { items: [{ text: "عشا" }, { text: "سينما" }] },
  coupons: { items: [{ title: "يوم كامل" }] },
  balloons: { items: [{ text: "ضحكتك" }, { text: "وجودك" }] },
  puzzle: { image: "d", size: "3" },
  memory: {},
  scratch: { text: "بحبك" },
  story: { start: "فاكر؟", a: "أيوه", aEnd: "طبعًا", b: "لأ", bEnd: "إزاي!" },
  reunion_countdown: { cityA: "القاهرة", cityB: "دبي", meetAt: "2026-12-30" },
  love_wrapped: { stats: { totalMessages: 1200, participants: [], topWords: [], topEmoji: [] } },
  remote_touch: {},
  treasure: { items: [{ text: "تحت المخدة" }, { text: "في المطبخ" }], finalText: "لقيتني ♡" }
};

test("every registry game has a sample, valid data and a wire key the server accepts", () => {
  for (const g of GAMES) {
    assert.ok(SAMPLE[g.key], `sample for ${g.key}`);
    assert.deepEqual(validateGame(g, SAMPLE[g.key], ctx), [], `valid ${g.key}`);
    assert.ok(GAME_KEYS.has(g.wire), `server knows ${g.wire}`);
  }
});

test("empty games are rejected client-side (no placeholder content)", () => {
  for (const g of GAMES.filter(g => !g.noData && g.key !== "memory")) assert.ok(validateGame(g, emptyGameData(g), ctx).length > 0, `empty ${g.key} must be invalid`);
});

test("wizard payload passes the server sanitizer with real answers intact", () => {
  const payload = buildGamesPayload(GAMES.map(g => ({ key: g.key, data: SAMPLE[g.key] })), ctx);
  const byWire = Object.fromEntries(payload.map((p, i) => [p.config.lamsaGame, sanitize(p, i)]));
  for (const g of GAMES) assert.ok(byWire[g.key], `sanitize(${g.key}) not null`);
  const quiz = byWire.who_of_us.config;
  assert.deepEqual(quiz.questions[0].options, ["سارة", "يوسف", "إحنا الاتنين"]);
  assert.equal(quiz.questions[0].answer, 1);
  assert.match(quiz.questions[0].reactions[1], /دايمًا/);
  const guess = byWire.guess_answer.config.questions[0];
  assert.equal(guess.options[guess.answer], "محشي");
  assert.equal(guess.message, "طبعًا");
  const story = byWire.order_story.config;
  assert.deepEqual(story.events.map(e => e.title), ["أول رسالة", "أول خروجة", "الخطوبة"]);
  assert.equal(story.events[0].imageRef, 1);
  assert.equal(story.winText, "برافو");
  assert.deepEqual(byWire.open_when.config.items[0], { title: "لما أوحشك", text: "أنا جنبك", imageRef: 2, once: true });
  assert.equal(byWire.true_false.config.items[1].answer, false);
  assert.equal(byWire.puzzle.config.imageRef, 3);
  assert.equal(byWire.treasure.type, "treasure");
  assert.equal(byWire.coupons.type, "coupons");
});

test("server drops unknown fields and script-like payloads stay plain text", () => {
  const evil = sanitize({ game: "open_when", config: { items: [{ title: "<img src=x onerror=alert(1)>", text: "x".repeat(5000) }], onload: "alert(1)", __proto__: { polluted: 1 } } }, 0);
  assert.equal(evil.config.onload, undefined);
  assert.equal(evil.config.items[0].text.length, 600);
  assert.equal(sanitize({ game: "not_a_game", config: {} }, 0), null);
  assert.equal(sanitize({ game: "true_false", config: { items: [] } }, 0), null, "no data -> rejected");
});
