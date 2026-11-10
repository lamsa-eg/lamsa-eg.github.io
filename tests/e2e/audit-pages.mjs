// Visual/console audit: loads key pages at several viewports, reports console
// errors, failed requests and horizontal overflow, and saves screenshots.
import { chromium } from "./pw.mjs";
import { createServer } from "../../tools/dev-server.mjs";
import { mkdir } from "node:fs/promises";

const pages = (process.env.PAGES || "/,/order-v19.html,/memory.html?demo=1&wow=1,/track.html,/privacy.html,/404-test,/admin/login.html").split(",");
const sizes = (process.env.SIZES || "360x800,390x844,412x915,768x1024,1366x768,1920x1080").split(",").map(s => s.split("x").map(Number));
const outDir = process.env.OUT || "reports/screenshots";
const shots = process.env.SHOTS !== "0";
await mkdir(outDir, { recursive: true });
const server = createServer(); await new Promise(r => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();
let problems = 0;
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: "ar-EG", reducedMotion: "reduce" });
  for (const p of pages) {
    const page = await ctx.newPage(); const errs = []; const external = new Set();
    await page.route(u => !u.href.startsWith(base), r => { external.add(new URL(r.request().url()).host); r.abort(); });
    page.on("console", m => { if (m.type() === "error" && !/ERR_FAILED|ERR_TUNNEL|status of 404/.test(m.text())) errs.push("console: " + m.text().slice(0, 200)); });
    page.on("pageerror", e => errs.push("pageerror: " + String(e).slice(0, 200)));
    page.on("requestfailed", r => { const u = r.url(); if (!u.startsWith(base) || /ERR_ABORTED/.test(r.failure()?.errorText || "")) return; errs.push("failed: " + u.replace(base, "")); });
    page.on("response", r => { const u = r.url(); if (u.startsWith(base) && r.status() >= 400 && !u.includes("404-test") && !(p.includes("m-0000000000000000") && u.endsWith("/api/public-memory"))) errs.push(`${r.status()}: ${u.replace(base, "")}`); });
    await page.goto(base + p, { waitUntil: "networkidle" }).catch(e => errs.push("goto: " + e.message));
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) errs.push(`horizontal overflow ${overflow}px`);
    if (shots) await page.screenshot({ path: `${outDir}/${p.replace(/[^a-z0-9]+/gi, "_")}_${w}x${h}.png`, fullPage: process.env.FULL === "1" });
    if (external.size && process.env.SHOW_EXTERNAL) console.log(`[${w}x${h}] ${p} external: ${[...external].join(", ")}`);
    if (errs.length) { problems += errs.length; console.log(`[${w}x${h}] ${p}\n  - ` + [...new Set(errs)].join("\n  - ")); }
    await page.close();
  }
  await ctx.close();
}
await browser.close(); server.close();
console.log(problems ? `\n${problems} problem(s)` : "No console errors / overflow found");
process.exitCode = problems ? 1 : 0;
