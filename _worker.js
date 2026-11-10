// LAMSA Cloudflare Pages advanced-mode Worker.
// Secrets are NEVER bundled here. Configure them in Cloudflare Pages ->
// Settings -> Variables and Secrets (see DEPLOYMENT.md):
//   LAMSA_WOW_GATEWAY_SECRET  (secret, required for WOW/games endpoints)
//   TURNSTILE_SITE_KEY        (plain, optional)
//   SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY (plain, optional overrides)
//   WOW_ENABLED               ("false" disables WOW endpoints; default on)
const DEFAULT_SUPABASE_URL = "https://qwavanugzcjevhtzjfuo.supabase.co";
// Publishable (anon) key: public by design, protected by RLS. Never put a
// service_role / secret key here.
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_mgNBl4z3uAsh4GLibYzPKw_tQLb-ZF0";
let SUPABASE_FUNCTIONS = `${DEFAULT_SUPABASE_URL}/functions/v1`;
let SUPABASE_STORAGE = `${DEFAULT_SUPABASE_URL}/storage/v1`;
let SUPABASE_REST = `${DEFAULT_SUPABASE_URL}/rest/v1`;
let PUBLISHABLE_KEY = DEFAULT_PUBLISHABLE_KEY;
let GATEWAY_SECRET = "";
function configure(env){
  const base=String(env?.SUPABASE_URL||DEFAULT_SUPABASE_URL).replace(/\/+$/,"");
  SUPABASE_FUNCTIONS=`${base}/functions/v1`;SUPABASE_STORAGE=`${base}/storage/v1`;SUPABASE_REST=`${base}/rest/v1`;
  PUBLISHABLE_KEY=String(env?.SUPABASE_PUBLISHABLE_KEY||DEFAULT_PUBLISHABLE_KEY);
  GATEWAY_SECRET=String(env?.LAMSA_WOW_GATEWAY_SECRET||"");
}
const ALLOWED_FUNCTIONS = new Set(["create-order","complete-order","abort-order","track-order","public-memory","claim-owner","admin-notifications","admin-update-order","order-notify-admin","attach-special-media","public-config","wow-unlock","wow-reply","wow-open-notify","wow-sender-subscribe","wow-track-replies","wow-admin-config","wow-gender-reveal","wow-event","order-wow-selection"]);
const CSP = "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https://qwavanugzcjevhtzjfuo.supabase.co https://qwavanugzcjevhtzjfuo.storage.supabase.co; media-src 'self' blob: https://qwavanugzcjevhtzjfuo.supabase.co https://qwavanugzcjevhtzjfuo.storage.supabase.co; connect-src 'self' https://qwavanugzcjevhtzjfuo.supabase.co https://qwavanugzcjevhtzjfuo.storage.supabase.co wss://qwavanugzcjevhtzjfuo.supabase.co https://challenges.cloudflare.com; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://www.tiktok.com https://challenges.cloudflare.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests";
function json(body,status=200,extra={}){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...extra}})}
function withMemoryHeaders(response){const h=new Headers(response.headers);h.set("X-Content-Type-Options","nosniff");h.set("Referrer-Policy","no-referrer");h.set("Permissions-Policy","microphone=(self), camera=(self), geolocation=(), nfc=(self)");h.set("X-Frame-Options","SAMEORIGIN");h.set("Cross-Origin-Opener-Policy","same-origin");h.set("Strict-Transport-Security","max-age=31536000; includeSubDomains");h.set("Content-Security-Policy",CSP);h.set("Cache-Control","no-cache, must-revalidate");h.set("X-Robots-Tag","noindex, nofollow, noarchive");return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h})}

async function publicConfig(ctx){
  const cacheKey=new Request("https://lamsa.internal/public-config",{method:"GET"});
  const cached=await caches.default.match(cacheKey);
  if(cached)return new Response(cached.body,{status:cached.status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-LAMSA-Config-Cache":"HIT"}});
  const headers={apikey:PUBLISHABLE_KEY,"Content-Type":"application/json"};
  try{
    const base="id,label,price,sort_order,max_images,max_image_bytes,allow_video,max_video_bytes,allow_audio,max_audio_bytes,allow_song";
    const pkgUrl=cols=>`${SUPABASE_REST}/packages?select=${cols}&active=eq.true&order=sort_order.asc`;
    // Extended columns come from migration 20261110_lamsa_v38; fall back gracefully before it is applied.
    let [pr,sr,gr]=await Promise.all([
      fetch(pkgUrl(`${base},max_games,is_recommended,tagline,features`),{headers}),
      fetch(`${SUPABASE_REST}/shipping_zones?select=id,label,fee,sort_order&active=eq.true&order=sort_order.asc`,{headers}),
      fetch(`${SUPABASE_REST}/game_catalog?select=key,label,description,active,sort_order,min_package&order=sort_order.asc`,{headers}).catch(()=>null)
    ]);
    if(!pr.ok)pr=await fetch(pkgUrl(base),{headers});
    if(!pr.ok||!sr.ok)throw new Error(`catalog upstream ${pr.status}/${sr.status}`);
    const [packages,shippingZones]=await Promise.all([pr.json(),sr.json()]);
    let games=null;if(gr&&gr.ok){try{const rows=await gr.json();if(Array.isArray(rows)&&rows.length)games=rows}catch{}}
    const payload=JSON.stringify({packages:(packages||[]).map(p=>({...p,price:Number(p.price)})),shippingZones:(shippingZones||[]).map(z=>({...z,fee:z.fee===null?null:Number(z.fee)})),games,generatedAt:new Date().toISOString()});
    const edge=new Response(payload,{status:200,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=60"}});
    ctx.waitUntil(caches.default.put(cacheKey,edge.clone()));
    return new Response(payload,{status:200,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-LAMSA-Config-Cache":"MISS"}});
  }catch(e){console.error("public config",e);return json({error:"تعذر تحميل الأسعار ومناطق الشحن"},502)}
}
async function proxyApi(request,name,ctx){if(!ALLOWED_FUNCTIONS.has(name))return json({error:"Not found"},404);if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{"Allow":"POST, OPTIONS","Cache-Control":"no-store"}});if(request.method!=="POST")return json({error:"Method not allowed"},405,{"Allow":"POST, OPTIONS"});const body=await request.arrayBuffer();let cacheKey=null;if(name==="public-memory"){try{const parsed=JSON.parse(new TextDecoder().decode(body));const slug=String(parsed?.slug||"").trim();if(/^m-[a-f0-9]{16}(?:[a-f0-9]{16})?$/i.test(slug)){const u=new URL(request.url);u.pathname=`/__lamsa_cache/public-memory/${slug}`;u.search="";cacheKey=new Request(u.toString(),{method:"GET"});const hit=await caches.default.match(cacheKey);if(hit){const headers=new Headers(hit.headers);headers.set("Cache-Control","no-store");headers.set("X-LAMSA-Edge-Cache","HIT");return new Response(hit.body,{status:hit.status,headers})}}}catch{}}
const headers=new Headers();headers.set("Content-Type",request.headers.get("Content-Type")||"application/json");headers.set("apikey",PUBLISHABLE_KEY);headers.set("x-lamsa-form-version",request.headers.get("x-lamsa-form-version")||"2");const auth=request.headers.get("Authorization");if(auth)headers.set("Authorization",auth);const ip=request.headers.get("CF-Connecting-IP")||request.headers.get("X-Forwarded-For")||"unknown";headers.set("x-lamsa-client-ip",ip.slice(0,120));headers.set("x-lamsa-client-ua",(request.headers.get("User-Agent")||"").slice(0,180));if(GATEWAY_SECRET)headers.set("x-lamsa-gateway",GATEWAY_SECRET);const upstream=await fetch(`${SUPABASE_FUNCTIONS}/${name}`,{method:"POST",headers,body,redirect:"manual"});if(name==="public-memory"){const text=await upstream.text();const outHeaders=new Headers(upstream.headers);outHeaders.set("Cache-Control","no-store");outHeaders.set("X-Content-Type-Options","nosniff");outHeaders.set("X-LAMSA-Edge-Cache","MISS");if(cacheKey&&upstream.ok){const cacheResponse=new Response(text,{status:200,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=60"}});ctx.waitUntil(caches.default.put(cacheKey,cacheResponse))}return new Response(text,{status:upstream.status,statusText:upstream.statusText,headers:outHeaders})}const outHeaders=new Headers(upstream.headers);outHeaders.set("Cache-Control","no-store");outHeaders.set("X-Content-Type-Options","nosniff");return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:outHeaders})}


function wowOn(env){return String(env?.WOW_ENABLED??"true").toLowerCase()!=="false"}
function wowSecret(){return GATEWAY_SECRET}
function wowCacheKey(slug,request){const u=new URL(request.url);u.pathname=`/__lamsa_cache/wow-public-memory/${slug}`;u.search="";return new Request(u.toString(),{method:"GET"})}
async function publicConfigWow(ctx,env){
  const base=await publicConfig(ctx),raw=await base.text();let data={};try{data=JSON.parse(raw)}catch{return base}
  const enabled=wowOn(env),secret=wowSecret(env);let catalog={addons:[],packs:[]};
  if(enabled&&secret){try{const r=await fetch(`${SUPABASE_FUNCTIONS}/wow-catalog`,{method:"POST",headers:{apikey:PUBLISHABLE_KEY,"Content-Type":"application/json","x-lamsa-gateway":secret},body:"{}"});if(r.ok)catalog=await r.json()}catch(e){console.warn("wow catalog",e)}}
  return json({...data,wowEnabled:enabled,turnstileSiteKey:enabled?String(env?.TURNSTILE_SITE_KEY||""):"",wowAddons:catalog.addons||[],wowPacks:catalog.packs||[],season:catalog.season||null});
}
async function proxyWowApi(request,name,env,ctx){
  const protectedNames=new Set(["public-memory","wow-unlock","wow-reply","wow-open-notify","wow-sender-subscribe","wow-track-replies","wow-sender-timeline","wow-admin-config","wow-gender-reveal","wow-event","wow-hunt-step","wow-generate","wow-rewrite","wow-love-wrapped","order-wow-selection"]);
  if(!protectedNames.has(name))return proxyApi(request,name,ctx);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{"Allow":"POST, OPTIONS","Cache-Control":"no-store"}});
  if(request.method!=="POST")return json({error:"Method not allowed"},405,{"Allow":"POST, OPTIONS"});
  const enabled=wowOn(env),secret=wowSecret(env);
  // Safe rollout: with WOW off and no gateway secret yet, existing V28 public-memory keeps working.
  if(name==="public-memory"&&!enabled&&!secret)return proxyApi(request,name,ctx);
  if(name!=="public-memory"&&!enabled)return json({error:"LAMSA WOW is disabled"},404);
  if(!secret)return json({error:"LAMSA WOW gateway secret is not configured"},503);
  const body=await request.arrayBuffer(),raw=new TextDecoder().decode(body);let parsed={};try{parsed=JSON.parse(raw||"{}")}catch{}
  let cacheKey=null,hasUnlock=false;if(name==="public-memory"){const slug=String(parsed?.slug||"").trim();hasUnlock=!!String(parsed?.wowToken||"").trim();if(!hasUnlock&&/^m-[a-f0-9]{16}(?:[a-f0-9]{16})?$/i.test(slug)){cacheKey=wowCacheKey(slug,request);const hit=await caches.default.match(cacheKey);if(hit){const h=new Headers(hit.headers);h.set("Cache-Control","no-store");h.set("X-LAMSA-Edge-Cache","HIT");return new Response(hit.body,{status:hit.status,headers:h})}}}
  const headers=new Headers();headers.set("Content-Type",request.headers.get("Content-Type")||"application/json");headers.set("apikey",PUBLISHABLE_KEY);headers.set("x-lamsa-form-version","wow-p2");headers.set("x-lamsa-gateway",secret);headers.set("x-lamsa-wow-enabled",wowOn(env)?"1":"0");const auth=request.headers.get("Authorization");if(auth)headers.set("Authorization",auth);const ip=request.headers.get("CF-Connecting-IP")||request.headers.get("X-Forwarded-For")?.split(",")[0]||"unknown";headers.set("x-lamsa-client-ip",ip.trim().slice(0,120));headers.set("x-lamsa-client-ua",(request.headers.get("User-Agent")||"").slice(0,180));
  let up;try{up=await fetch(`${SUPABASE_FUNCTIONS}/${name}`,{method:"POST",headers,body,redirect:"manual"})}catch(e){return json({error:"تعذر الاتصال بالخدمة"},502)}const text=await up.text(),oh=new Headers(up.headers);oh.set("Cache-Control","no-store");let d=null;try{d=JSON.parse(text)}catch{}
  if(name==="public-memory"&&cacheKey){oh.set("X-LAMSA-Edge-Cache","MISS");if(up.ok&&!hasUnlock&&d?.wow?.cacheable!==false)ctx.waitUntil(caches.default.put(cacheKey,new Response(text,{headers:{"Content-Type":"application/json","Cache-Control":"public, max-age=60"}})));else if(d?.wow?.cacheable===false)ctx.waitUntil(caches.default.delete(cacheKey))}
  if(name==="wow-admin-config"&&up.ok&&d?.slug){ctx.waitUntil(caches.default.delete(wowCacheKey(String(d.slug),request)))}return new Response(text,{status:up.status,statusText:up.statusText,headers:oh});
}
function validWowUploadPath(path){return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp|webm|ogg|mp3|m4a)$/i.test(path)&&!path.includes("..")}
async function proxyWowUpload(request){if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{"Allow":"PUT, OPTIONS","Cache-Control":"no-store"}});if(request.method!=="PUT")return json({error:"Method not allowed"},405);const u=new URL(request.url),path=u.searchParams.get("path")||"",token=u.searchParams.get("token")||"";if(!validWowUploadPath(path)||token.length<20||token.length>2000)return json({error:"Invalid upload ticket"},400);const length=Number(request.headers.get("content-length")||0);if(length&&length>10*1024*1024)return json({error:"الملف أكبر من الحد المسموح"},413);const mime=(request.headers.get("content-type")||"").split(";")[0].toLowerCase(),allowed=new Set(["image/jpeg","image/png","image/webp","audio/webm","audio/ogg","audio/mpeg","audio/mp4","audio/x-m4a"]);if(!allowed.has(mime))return json({error:"صيغة الملف غير مسموحة"},415);const encoded=path.split("/").map(encodeURIComponent).join("/"),target=`${SUPABASE_STORAGE}/object/upload/sign/wow-replies/${encoded}?token=${encodeURIComponent(token)}`,headers=new Headers({apikey:PUBLISHABLE_KEY,"content-type":mime,"x-upsert":"false"});const up=await fetch(target,{method:"PUT",headers,body:request.body,redirect:"manual"});const text=await up.text();return new Response(text||JSON.stringify({ok:up.ok}),{status:up.status,headers:{"Content-Type":up.headers.get("content-type")||"application/json","Cache-Control":"no-store"}})}

function extractTikTokId(value){try{const u=new URL(value);const m=u.pathname.match(/\/(?:video|photo)\/(\d{8,25})(?:\/|$)/i);return m?.[1]||""}catch{return ""}}
function allowedTikTokUrl(value){try{const u=new URL(value);const h=u.hostname.toLowerCase();return u.protocol==="https:"&&(h==="tiktok.com"||h.endsWith(".tiktok.com"))}catch{return false}}
async function tiktokResolve(request){
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{"Allow":"GET, OPTIONS","Cache-Control":"no-store"}});
  if(request.method!=="GET")return json({error:"Method not allowed"},405,{"Allow":"GET, OPTIONS"});
  const u=new URL(request.url),input=(u.searchParams.get("url")||"").trim();
  if(!input||input.length>700||!allowedTikTokUrl(input))return json({error:"رابط TikTok غير صالح"},400);
  let id=extractTikTokId(input),resolvedUrl=input;
  if(!id){
    try{
      const o=await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(input)}`,{headers:{"Accept":"application/json","User-Agent":"Mozilla/5.0 LAMSA/1.0"},redirect:"follow"});
      if(o.ok){const d=await o.json();const html=String(d?.html||"");const m=html.match(/data-video-id=["'](\d{8,25})["']/i)||html.match(/\/(?:video|photo)\/(\d{8,25})/i);if(m)id=m[1]}
    }catch(e){console.warn("tiktok oembed",e)}
  }
  if(!id){
    try{
      const r=await fetch(input,{method:"GET",redirect:"follow",headers:{"User-Agent":"Mozilla/5.0 LAMSA/1.0","Accept":"text/html,*/*"}});
      resolvedUrl=r.url||input;id=extractTikTokId(resolvedUrl);
    }catch(e){console.warn("tiktok redirect",e)}
  }
  if(!id)return json({error:"تعذر التعرف على فيديو TikTok. جرّب نسخ رابط الفيديو الكامل."},422);
  const embedUrl=`https://www.tiktok.com/player/v1/${encodeURIComponent(id)}?controls=1&progress_bar=1&play_button=1&volume_control=1&fullscreen_button=1&loop=0&autoplay=0&music_info=1&description=1&rel=0`;
  return json({ok:true,id,embedUrl,resolvedUrl});
}

function validUploadPath(path){return /^[0-9a-f-]{36}\/[0-9a-f-]{36}-[^/]{1,120}$/i.test(path)&&!path.includes("..")}
async function proxyUpload(request){if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{"Allow":"PUT, OPTIONS","Cache-Control":"no-store"}});if(request.method!=="PUT")return json({error:"Method not allowed"},405,{"Allow":"PUT, OPTIONS"});const u=new URL(request.url);const path=u.searchParams.get("path")||"",token=u.searchParams.get("token")||"";if(!validUploadPath(path)||token.length<20||token.length>2000)return json({error:"Invalid upload ticket"},400);const length=Number(request.headers.get("content-length")||0);if(length>50*1024*1024)return json({error:"الملف أكبر من الحد المسموح"},413);const mime=(request.headers.get("content-type")||"application/octet-stream").split(";")[0].toLowerCase();const allowed=new Set(["image/jpeg","image/png","image/webp","video/mp4","video/quicktime","audio/mpeg","audio/mp4","audio/x-m4a","audio/wav"]);if(!allowed.has(mime))return json({error:"صيغة الملف غير مسموحة"},415);const encodedPath=path.split("/").map(encodeURIComponent).join("/");const target=`${SUPABASE_STORAGE}/object/upload/sign/order-uploads/${encodedPath}?token=${encodeURIComponent(token)}`;const headers=new Headers();headers.set("apikey",PUBLISHABLE_KEY);headers.set("content-type",mime);headers.set("cache-control","max-age=3600");headers.set("x-upsert","false");let upstream;try{upstream=await fetch(target,{method:"PUT",headers,body:request.body,redirect:"manual"})}catch(e){console.error("upload proxy fetch failed",e);return json({error:"تعذر الاتصال بخدمة التخزين"},502)}const text=await upstream.text();const outHeaders={"Content-Type":upstream.headers.get("content-type")||"application/json; charset=utf-8","Cache-Control":"no-store","X-LAMSA-Upload-Proxy":"1"};if(!upstream.ok){let msg="تعذر رفع الملف";try{const x=JSON.parse(text);msg=x.message||x.error||msg}catch{}return json({error:msg,status:upstream.status},upstream.status,outHeaders)}return new Response(text||JSON.stringify({ok:true}),{status:upstream.status,headers:outHeaders})}
export default{async fetch(request,env,ctx){configure(env);const url=new URL(request.url);if(url.pathname==="/api/public-config")return publicConfigWow(ctx,env);if(url.pathname==="/api/tiktok-resolve")return tiktokResolve(request);if(url.pathname.startsWith("/api/")){const name=url.pathname.slice(5).replace(/\/+$/g,"");return proxyWowApi(request,name,env,ctx)}if(url.pathname==="/upload/wow-reply")return proxyWowUpload(request);if(url.pathname==="/upload/order")return proxyUpload(request);if(url.pathname.startsWith("/m/")||url.pathname==="/memory.html"){const assetUrl=new URL(request.url);assetUrl.pathname="/memory.html";assetUrl.search="";const assetRequest=new Request(assetUrl.toString(),{method:"GET",headers:request.headers});return withMemoryHeaders(await env.ASSETS.fetch(assetRequest))}return env.ASSETS.fetch(request)}};
