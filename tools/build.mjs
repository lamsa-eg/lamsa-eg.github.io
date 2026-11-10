// LAMSA production build for Cloudflare Pages.
//   node tools/build.mjs            -> dist/  (deploy this folder)
//   node tools/build.mjs --zip      -> also dist/../lamsa-cloudflare-pages-v40.zip
// Only files reachable from the public HTML pages (plus dynamically imported
// game modules) are shipped. Docs, tests, tools, supabase/ and any .env are
// never copied. CSS/JS are minified with esbuild when it is installed.
import { readFile, writeFile, mkdir, rm, stat, readdir, copyFile } from "node:fs/promises";
import { join, dirname, normalize, relative, extname, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const ROOT = normalize(join(fileURLToPath(import.meta.url), "../.."));
const OUT = join(ROOT, "dist");
const ENTRIES = ["index.html", "order.html", "order-success.html", "memory.html", "track.html", "privacy.html", "terms.html", "404.html", "order-v19.html", "admin/index.html", "admin/login.html", "admin/dashboard.html", "admin/order-detail.html", "admin/memory-editor.html", "admin/nfc-writer.html", "admin/shipping-settings.html", "admin/setup-owner.html", "admin/catalog.html"];
const ALWAYS = ["_worker.js", "_headers", "_redirects", "_routes.json", "robots.txt", "sitemap.xml", "favicon.svg", "site.webmanifest", "manifest.webmanifest", "sw-v18.js", "version.txt", "assets/img/og-lamsa.jpg", "assets/img/icon-192.png", "assets/img/icon-512.png"];
// Loaded through template-string dynamic imports / script injection at runtime.
const DYNAMIC_DIRS = ["assets/js/wow/moments", "assets/js/wow/legacy/moments", "assets/js/wow/gates", "assets/demo-v2", "assets/audio", "assets/fonts"];
const DENY = /(^|\/)(\.env|\.dev\.vars|wrangler\.json|.*\.md|tests|tools|docs|supabase|node_modules|\.git)(\/|$)/i;

const exists = p => stat(join(ROOT, p)).then(s => s.isFile()).catch(() => false);
const files = new Set();
async function addDir(d) { for (const e of await readdir(join(ROOT, d), { withFileTypes: true })) { const p = posix.join(d, e.name); if (e.isDirectory()) await addDir(p); else files.add(p); } }

function refs(text, from) {
  const out = [], dir = posix.dirname(from);
  const push = raw => {
    if (!raw || /^(https?:|data:|blob:|mailto:|tel:|#|\$\{|javascript:)/i.test(raw) || raw.includes("${")) return;
    const clean = raw.split(/[?#]/)[0]; if (!clean) return;
    let p = clean.startsWith("/") ? clean.slice(1) : posix.normalize(posix.join(dir, clean));
    if (p === "order" || p === "") return;
    out.push(p);
  };
  for (const m of text.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) push(m[1]);
  for (const m of text.matchAll(/(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']/g)) push(m[1]);
  for (const m of text.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) push(m[1]);
  for (const m of text.matchAll(/import\s*["']([^"']+)["']/g)) push(m[1]);
  for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) push(m[1]);
  for (const m of text.matchAll(/["'](\/assets\/[^"'`\s]+\.(?:js|css|webp|png|jpg|svg|mp3|mp4|woff2))["']/g)) push(m[1]);
  return out;
}

async function crawl() {
  const queue = [...ENTRIES, ...ALWAYS], seen = new Set(), missing = [];
  for (const d of DYNAMIC_DIRS) await addDir(d);
  for (const f of [...files]) if (/\.(js|css)$/.test(f)) queue.push(f);
  while (queue.length) {
    const p = queue.shift(); if (seen.has(p)) continue; seen.add(p);
    if (DENY.test(p)) continue;
    if (!(await exists(p))) { missing.push(p); continue; }
    files.add(p);
    if (/\.(html|js|mjs|css)$/.test(p)) for (const r of refs(await readFile(join(ROOT, p), "utf8"), p)) if (!seen.has(r)) queue.push(r);
  }
  return missing;
}

function loadEsbuild() {
  const req = createRequire(import.meta.url);
  for (const id of ["esbuild", join(ROOT, "node_modules/esbuild")]) { try { return req(id); } catch {} }
  return null;
}

const missing = await crawl();
// Every JS/CSS file under assets/ that the crawl reached (and nothing else) — e.g. legacy order-v19 code is dropped.
await rm(OUT, { recursive: true, force: true });
const esbuild = loadEsbuild();
let bytesIn = 0, bytesOut = 0;
for (const p of [...files].sort()) {
  if (DENY.test(p)) continue;
  const src = join(ROOT, p), dst = join(OUT, p);
  await mkdir(dirname(dst), { recursive: true });
  const ext = extname(p);
  if (esbuild && (ext === ".css" || (ext === ".js" && p !== "_worker.js" && !p.endsWith(".min.js")))) {
    const code = await readFile(src, "utf8");
    try {
      const r = await esbuild.transform(code, { loader: ext.slice(1), minify: true, legalComments: "none", charset: "utf8", target: ext === ".css" ? ["chrome90", "safari14"] : "es2022" });
      bytesIn += code.length; bytesOut += r.code.length; await writeFile(dst, r.code); continue;
    } catch (e) { console.warn(`minify skipped for ${p}: ${e.message.split("\n")[0]}`); }
  }
  await copyFile(src, dst);
}
// Safety net: refuse to ship anything that looks like a secret.
// service_role JWTs contain base64("service_role") = c2VydmljZV9yb2xl
const SECRET_PATTERNS = [/c2VydmljZV9yb2xl/, /sb_secret_[A-Za-z0-9_-]{10,}/, /SUPABASE_SERVICE_ROLE_KEY\s*=/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\b[0-9a-f]{64}\b(?=.*gateway)/i, /ANTHROPIC_API_KEY\s*=/];
const shipped = [];
async function walk(d) { for (const e of await readdir(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) await walk(p); else shipped.push(p); } }
await walk(OUT);
for (const f of shipped) { if (!/\.(js|html|css|json|txt|webmanifest|xml)$|_headers|_redirects/.test(f)) continue; const t = await readFile(f, "utf8"); for (const re of SECRET_PATTERNS) if (re.test(t)) { console.error(`✗ Possible secret in ${relative(OUT, f)} (${re})`); process.exit(1); } }
console.log(`✓ dist/ ready: ${shipped.length} files${esbuild ? ` · JS/CSS minified ${Math.round(bytesIn / 1024)}KB → ${Math.round(bytesOut / 1024)}KB` : " · (esbuild not installed: files copied unminified)"}`);
if (missing.length) console.warn(`! unresolved references (check): ${[...new Set(missing)].join(", ")}`);
if (process.argv.includes("--zip")) {
  const zip = join(ROOT, "lamsa-cloudflare-pages-v40.zip"); await rm(zip, { force: true });
  execFileSync("zip", ["-qr", "-X", zip, "."], { cwd: OUT });
  console.log(`✓ ${relative(ROOT, zip)} (${Math.round((await stat(zip)).size / 1024)}KB)`);
}
