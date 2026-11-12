// End-to-end journey against the local mock backend:
// home -> order wizard (12 steps, draft restore, uploads) -> order stored with
// real game answers -> admin publish (mock) -> memory page plays those answers.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "./pw.mjs";
import { createServer } from "../../tools/dev-server.mjs";

let server, base, browser;
const photos = [1, 2, 3, 4, 5].map(n => new URL(`../fixtures/photo-${n}.jpg`, import.meta.url).pathname);
const errorsOf = page => { const errs = []; page.on("pageerror", e => errs.push(String(e))); page.on("console", m => { if (m.type() === "error" && !/ERR_FAILED|ERR_TUNNEL|404|ERR_NAME/.test(m.text())) errs.push(m.text()); }); return errs; };
async function blockExternal(page) { await page.route(u => !u.href.startsWith(base), r => r.abort()); }

before(async () => { server = createServer(); await new Promise(r => server.listen(0, r)); base = `http://localhost:${server.address().port}`; browser = await chromium.launch(); });
after(async () => { await browser?.close(); server?.close(); });

async function next(page) { await page.click("#nextBtn"); }
async function stepIs(page, name) { await page.waitForSelector(`[data-step="${name}"]:not([hidden])`); }

test("full order journey with real game answers reaches the memory page", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
  const page = await ctx.newPage(); await blockExternal(page); const errs = errorsOf(page);

  await page.goto(base + (process.env.FROM_HOME === "0" ? "/order" : "/"));
  if (process.env.FROM_HOME !== "0") await page.click('[data-cta="hero-start"]');
  await stepIs(page, "occasion");

  // Step 1 — validation then fill
  await next(page);
  assert.match(await page.textContent('[data-err="occasion"]'), /اختار المناسبة/);
  await page.click('#occasionChips label:has-text("عيد ميلاد")');
  await page.click('#relationshipChips label:has-text("حبيبي")');
  await stepIs(page, "people"); // same screen as the occasion

  await page.fill("#senderName", "سارة"); await page.fill("#recipientName", "يوسف");
  await page.check('input[name="recipientGender"][value="m"]');
  await next(page); await stepIs(page, "package");
  await page.waitForSelector(".ow-pkg");
  assert.equal(await page.locator(".ow-pkg").count(), 3);
  assert.match(await page.textContent(".ow-pkg.is-rec"), /ننصح بها/);
  await page.click('.ow-pkg:has(input[value="premium"])');
  await next(page); await stepIs(page, "media");

  // Media — upload, reorder, delete
  await next(page);
  assert.match(await page.textContent('[data-err="images"]'), /صورة واحدة/);
  await page.setInputFiles("#imageInput", photos);
  await page.waitForFunction(() => document.querySelectorAll(".ow-thumb").length === 5);
  const firstId = await page.getAttribute(".ow-thumb:nth-child(1)", "data-id");
  await page.click('.ow-thumb:nth-child(1) [data-move="1"]');
  assert.equal(await page.getAttribute(".ow-thumb:nth-child(2)", "data-id"), firstId, "image moved one position later");
  await page.click(".ow-thumb:nth-child(5) [data-del]");
  await page.waitForFunction(() => document.querySelectorAll(".ow-thumb").length === 4);
  await next(page); await stepIs(page, "story"); await stepIs(page, "look");

  await page.fill("#message", "كل سنة وإنت أجمل حكاية في عمري، ولسه البداية.");
  await page.fill("#sq-firstMeet", "معرض الكتاب");
  await page.fill("#sq-habit", "بيتأخر دايمًا ربع ساعة");
  await next(page); await stepIs(page, "games"); await stepIs(page, "surprises");

  // Games — three real-answer games
  for (const key of ["who_of_us", "order_story", "open_when"]) await page.click(`[data-toggle="${key}"]`);
  assert.match(await page.textContent('[data-game="who_of_us"]'), /محتاجة إجاباتك/);
  await next(page); await stepIs(page, "answers");

  await next(page); // empty answers -> inline errors
  assert.ok(await page.locator(".ow-game-err").count() > 0, "shows inline game errors");
  const ed = k => `[data-editor="${k}"]`;
  await page.fill(`${ed("who_of_us")} [data-gpath="items.0.q"]`, "مين اللي بيتأخر دايمًا؟");
  await page.check(`${ed("who_of_us")} [data-gpath="items.0.who"][value="recipient"]`);
  await page.fill(`${ed("who_of_us")} [data-gpath="items.0.comment"]`, "ربع ساعة بالظبط 😄");
  await page.fill(`${ed("who_of_us")} [data-gpath="items.1.q"]`, "مين قال بحبك الأول؟");
  await page.check(`${ed("who_of_us")} [data-gpath="items.1.who"][value="sender"]`);
  for (const [i, t] of ["معرض الكتاب", "أول خروجة", "الخطوبة"].entries()) await page.fill(`${ed("order_story")} [data-gpath="items.${i}.title"]`, t);
  await page.check(`${ed("order_story")} [data-gpath="items.0.image"] >> nth=2`);
  await page.fill(`${ed("open_when")} [data-gpath="items.0.title"]`, "لما أوحشك");
  await page.fill(`${ed("open_when")} [data-gpath="items.0.text"]`, "افتكر إني جنبك حتى لو بعيد.");
  await next(page); await stepIs(page, "delivery");
  assert.match(await page.textContent("#stepCount"), /الخطوة 7 من 8/);

  await page.selectOption("#zone", "cairo");
  await page.fill("#city", "القاهرة"); await page.fill("#area", "مدينة نصر"); await page.fill("#street", "شارع تجريبي 10"); await page.fill("#phone", "01000000000");
  await next(page); await stepIs(page, "review");

  // Draft survives a reload, including the photos (IndexedDB)
  await page.reload(); await stepIs(page, "review");
  await page.waitForFunction(() => [...document.querySelectorAll(".ow-rev-imgs img")].filter(i => i.src.startsWith("blob:")).length === 4);
  assert.match(await page.textContent("#reviewBody"), /يوسف/);

  // Browser back goes to previous step without losing data
  await page.goBack(); await stepIs(page, "delivery");
  assert.equal(await page.inputValue("#city"), "القاهرة");
  await page.goForward(); await stepIs(page, "review");

  await next(page);
  assert.match(await page.textContent('[data-err="legal"]'), /الشروط/);
  await page.check('[data-k="legal"]');
  await Promise.all([page.waitForURL(/order-success/, { timeout: 30_000 }), page.click("#nextBtn"), page.click("#nextBtn").catch(() => {})]);

  const orders = await (await fetch(base + "/__mock/orders")).json();
  assert.equal(orders.length, 1, "double click created exactly one order");
  const o = orders[0];
  assert.equal(o.state, "complete");
  assert.equal(o.body.uploads.filter(u => u.kind === "image").length, 4);
  const quiz = o.games.find(g => g.game === "quiz").config;
  assert.deepEqual(quiz.questions[0].options, ["سارة", "يوسف", "إحنا الاتنين"]);
  assert.equal(quiz.questions[0].answer, 1);
  assert.equal(quiz.__storyBuild.storyAnswers.firstMeet, "معرض الكتاب");
  const story = o.games.find(g => g.game === "order_story").config;
  assert.deepEqual(story.events.map(e => e.title), ["معرض الكتاب", "أول خروجة", "الخطوبة"]);
  assert.equal(story.events[0].imageRef, 1);
  const letters = o.games.find(g => g.game === "open_when").config;
  assert.equal(letters.items[0].title, "لما أوحشك");

  // InstaPay: amount, pay link and receipt upload on the success page
  await page.waitForSelector("#payBox:not([hidden])");
  assert.equal(await page.getAttribute("#payLink", "href"), "https://ipn.eg/S/test-shop/instapay/TEST");
  assert.match(await page.textContent("#payIpa"), /test-shop@instapay/);
  assert.equal(o.body.paymentMethod, "instapay");
  await page.setInputFiles("#proofInput", photos[0]);
  await page.waitForFunction(() => /وصلنا/.test(document.getElementById("proofStatus").textContent), null, { timeout: 15_000 });
    // Draft cleared after success
  assert.equal(await page.evaluate(() => localStorage.getItem("lamsa:order-draft:v38")), null);

  // Admin publishes (mock) -> recipient opens the memory
  const { slug } = await (await fetch(base + "/__mock/publish", { method: "POST", body: JSON.stringify({ orderNumber: o.orderNumber }) })).json();
  const m = await ctx.newPage(); await blockExternal(m); const mErrs = errorsOf(m);
  await m.goto(`${base}/m/${slug}`);
  await m.waitForSelector("#openBtn:not([disabled])");
  assert.match(await m.textContent("#openTitle"), /يوسف/);
  await m.click("#openBtn");
  await m.waitForSelector("#page:not([hidden])");
  assert.match(await m.textContent("#names"), /يوسف/);
  assert.equal(await m.locator("#gallery figure").count(), 4, "gallery shows the 4 uploaded photos");
  await m.waitForSelector(".wow-m-game", { timeout: 15_000 });
  const envelopes = await m.locator(".wow-envelope").allTextContents();
  assert.ok(envelopes.some(t => /مين فينا/.test(t)), "who_of_us envelope present");
  const quizSec = m.locator(".wow-m-game", { hasText: "مين فينا" }).first();
  await quizSec.locator(".wow-envelope").click();
  await m.waitForSelector("text=مين اللي بيتأخر دايمًا؟");
  await quizSec.locator(".wow-quiz-opts button", { hasText: "يوسف" }).click();
  await m.waitForSelector("text=ربع ساعة بالظبط", { timeout: 5000 });
  const storySec = m.locator(".wow-m-game", { hasText: "رتّب ذكرياتنا" }).first();
  await storySec.locator(".wow-envelope").click();
  assert.equal(await storySec.locator(".wow-story-photo").count(), 3);
  assert.ok(await storySec.locator("text=أول خروجة").count() > 0, "events use the real titles");
  const html = await m.content();
  assert.ok(!/أنا اللي بتأخر أكتر|لما تزعل\/تزعلي/.test(html), "no demo placeholder content");
  assert.deepEqual(errs, []); assert.deepEqual(mErrs, []);
  await ctx.close();
});

test("invalid memory link shows a friendly error", async () => {
  const page = await browser.newPage(); await blockExternal(page);
  await page.goto(`${base}/m/m-0000000000000000`);
  await page.waitForFunction(() => document.getElementById("memoryError")?.textContent.trim().length > 0, null, { timeout: 15_000 });
  assert.match(await page.textContent("#memoryError"), /الرابط ده مش صحيح/);
  await page.close();
});

test("server error during submit keeps the draft and allows retry", async () => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage(); await blockExternal(page);
  await page.goto(base + "/order?package=mini");
  await page.click('#occasionChips label:has-text("اعتذار")'); await page.click('#relationshipChips label:has-text("صديق")');
  await page.fill("#senderName", "منى"); await page.fill("#recipientName", "هالة"); await page.check('input[name="recipientGender"][value="f"]'); await next(page);
  await page.waitForSelector('.ow-pkg input[value="mini"]:checked'); await next(page);
  await page.setInputFiles("#imageInput", photos.slice(0, 2)); await page.waitForFunction(() => document.querySelectorAll(".ow-thumb").length === 2); await next(page);
  await page.fill("#message", "آسفة من قلبي، وحشتيني جدًا."); await next(page);
  assert.match(await page.textContent("#gamesAllowance"), /لا تشمل ألعاب/);
  await next(page); // no games -> the answers screen is skipped
  await stepIs(page, "delivery"); assert.match(await page.textContent("#stepCount"), /الخطوة 6 من 7/);
  await page.selectOption("#zone", "other"); await page.fill("#city", "طنطا"); await page.fill("#area", "وسط البلد"); await page.fill("#street", "شارع تجريبي 5"); await page.fill("#phone", "01111111111"); await next(page);
  await page.check('[data-k="legal"]');
  await fetch(base + "/__mock/fail", { method: "POST", body: JSON.stringify({ "complete-order": 503 }) });
  await page.click("#nextBtn");
  await page.waitForSelector("#sendError:not([hidden])", { timeout: 20_000 });
  assert.ok(await page.evaluate(() => !!localStorage.getItem("lamsa:order-draft:v38")), "draft kept after failure");
  await fetch(base + "/__mock/fail", { method: "POST", body: JSON.stringify({ "complete-order": 0 }) });
  await Promise.all([page.waitForURL(/order-success/, { timeout: 30_000 }), page.click("#retrySend")]);
  const orders = await (await fetch(base + "/__mock/orders")).json();
  assert.equal(orders.filter(o => o.body.customization.senderName === "منى").length, 1, "retry reused the same order (idempotent requestId)");
  await ctx.close();
});
