// Renders the Facebook/Instagram ad images into docs/marketing/creatives/.
// Usage: PORT=8799 node tools/dev-server.mjs &  then  node tools/ads/render.mjs [--price=299] [--base=http://localhost:8799]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split("=")[1] || "";
const base = arg("base") || "http://localhost:8799", price = arg("price"), out = "docs/marketing/creatives";
const FORMATS = { feed: [1080, 1350], square: [1080, 1080], story: [1080, 1920] };
const CONCEPTS = ["hero", "game", "tap", "steps", "birthday", "anniversary"];
const b = await chromium.launch();
const shot = async (c, name, w, h) => {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.goto(`${base}/tools/ads/ad.html?c=${c}&price=${price}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250);
  await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 92 }); await p.close(); console.log(name);
};
for (const c of CONCEPTS) for (const [f, [w, h]] of Object.entries(FORMATS)) await shot(c, `lamsa-${c}-${f}-${w}x${h}`, w, h);
await shot("hero", "lamsa-hero-link-1200x628", 1200, 628);
await shot("hero", "lamsa-page-cover-1640x624", 1640, 624);
// Page kit (docs/marketing/page): avatar, cover, extra organic post images.
const page = async (url, name, w, h) => { const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); await p.goto(`${base}${url}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250); await p.screenshot({ path: `docs/marketing/page/${name}.jpg`, type: "jpeg", quality: 93 }); await p.close(); console.log(name); };
await page("/tools/ads/page.html?k=avatar", "profile-1080x1080", 1080, 1080);
await page("/tools/ads/page.html?k=cover", "cover-1640x720", 1640, 720);
for (const c of ["welcome", "privacy"]) await page(`/tools/ads/ad.html?c=${c}`, `post-${c}-1080x1080`, 1080, 1080);
await b.close();
