// Renders a vertical video (default: the 15s reel) by seeking CSS animations frame by frame. Needs ffmpeg + dev server.
// Promo cut: node tools/ads/reel.mjs --page=promo --secs=18 --price=299 (silent; voiceover + music are mixed in afterwards).
import { createRequire } from "node:module"; import { mkdirSync, rmSync } from "node:fs"; import { execFileSync } from "node:child_process";
const { chromium } = createRequire(import.meta.url)("playwright");
const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split("=")[1] || "";
const base = arg("base") || "http://localhost:8799", FPS = 25, SECS = Number(arg("secs")) || 15, pageName = arg("page") || "reel", tmp = arg("tmp") || ".reel-frames";
const out = arg("out") || `docs/marketing/creatives/lamsa-${pageName}-1080x1920.mp4`;
rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await p.goto(`${base}/tools/ads/${pageName}.html?price=${arg("price")}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
for (let f = 0; f < FPS * SECS; f++) { await p.evaluate(ms => window.seek(ms), (f * 1000) / FPS); await p.screenshot({ path: `${tmp}/f${String(f).padStart(4, "0")}.jpg`, type: "jpeg", quality: 90 }); }
await b.close();
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-framerate", String(FPS), "-i", `${tmp}/f%04d.jpg`, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", "-movflags", "+faststart", out]);
rmSync(tmp, { recursive: true, force: true }); console.log("reel done");
