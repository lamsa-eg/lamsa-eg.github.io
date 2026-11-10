import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
export function serverSecret():string{
  const single=Deno.env.get("SUPABASE_SECRET_KEY");if(single)return single;
  const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(legacy)return legacy;
  const dict=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(dict){try{const p=JSON.parse(dict);const k=p.default??Object.values(p)[0];if(typeof k==="string"&&k)return k}catch{}}
  throw new Error("Missing Supabase secret key");
}
export const SERVICE_SECRET=serverSecret();
// The gateway secret is shared with the Cloudflare Worker and must only live in
// Supabase secrets (LAMSA_WOW_GATEWAY_SECRET). It is never bundled in code.
export const admin=createClient(SUPABASE_URL,SERVICE_SECRET,{auth:{persistSession:false,autoRefreshToken:false}});
export const ORIGIN=Deno.env.get("ALLOWED_ORIGIN")||"https://lamsagift.pages.dev";
export const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, content-type, apikey, x-client-info, x-lamsa-client-ip, x-lamsa-client-ua, x-lamsa-gateway, x-lamsa-wow-enabled, x-lamsa-form-version","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
export function out(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}
export function clean(v:unknown,max=200){return String(v??"").trim().slice(0,max)}
export async function sha256Text(v:string){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("")}
export async function gatewayOk(req:Request){
  const configured=Deno.env.get("LAMSA_WOW_GATEWAY_SECRET")||"",got=req.headers.get("x-lamsa-gateway")||"";
  if(!got||configured.length<32)return false;
  // Compare digests so the comparison time does not depend on the secret.
  return (await sha256Text(got))===(await sha256Text(configured));
}
export function trustedIp(req:Request){return (req.headers.get("x-lamsa-client-ip")||"unknown").trim().slice(0,120)}
export async function rateAllowed(action:string,keyMaterial:string,limit:number,windowSeconds:number){const key=await sha256Text(`${action}|${keyMaterial}`);const{data,error}=await admin.rpc("consume_rate_limit",{p_action:action,p_key_hash:key,p_limit:limit,p_window_seconds:windowSeconds});if(error)throw error;return data===true}
export async function turnstileOk(token:string,ip:string){const secret=Deno.env.get("TURNSTILE_SECRET_KEY")||"";if(!secret)return{ok:false,missing:true};if(!token)return{ok:false,missing:false};const form=new FormData();form.set("secret",secret);form.set("response",token);if(ip&&ip!=="unknown")form.set("remoteip",ip);try{const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:form});const d=await r.json();return{ok:d?.success===true,missing:false}}catch{return{ok:false,missing:false}}}
export function normalizeSecretAnswer(v:unknown){let s=String(v??"").normalize("NFC").trim().toLocaleLowerCase("ar");s=s.replace(/[\u064B-\u065F\u0670\u0640]/g,"").replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/\s+/g," ").trim();if(s.startsWith("ال")&&s.length>2)s=s.slice(2).trim();return s}
function b64urlBytes(bytes:Uint8Array){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
function b64urlText(s:string){return b64urlBytes(new TextEncoder().encode(s))}
function fromB64url(s:string){const p=s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4);const raw=atob(p);return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function hmac(value:string){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(SERVICE_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);const sig=await crypto.subtle.sign("HMAC",k,new TextEncoder().encode(value));return new Uint8Array(sig)}
export async function issueToken(payload:Record<string,unknown>){const enc=b64urlText(JSON.stringify(payload));return `${enc}.${b64urlBytes(await hmac(enc))}`}
export async function verifyToken(token:string,expected:Record<string,string>){try{const[a,b]=String(token||"").split(".");if(!a||!b)return null;const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(SERVICE_SECRET),{name:"HMAC",hash:"SHA-256"},false,["verify"]);const ok=await crypto.subtle.verify("HMAC",k,fromB64url(b),new TextEncoder().encode(a));if(!ok)return null;const p=JSON.parse(new TextDecoder().decode(fromB64url(a)));if(Number(p.exp||0)<Date.now())return null;for(const[k2,v]of Object.entries(expected))if(String(p[k2]??"")!==String(v))return null;return p}catch{return null}}
export async function actor(req:Request){const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();if(!jwt)return null;const{data:{user},error}=await admin.auth.getUser(jwt);if(error||!user)return null;const{data:profile,error:pErr}=await admin.from("admin_profiles").select("role").eq("user_id",user.id).maybeSingle();if(pErr)throw pErr;if(!profile||!["owner","admin","editor"].includes(profile.role))return null;return{user,profile}}
export async function verifyTracking(orderNumber:string,trackingToken:string){if(!orderNumber||!trackingToken)return null;const h=await sha256Text(trackingToken);const{data,error}=await admin.from("orders").select("id,order_number,recipient_name,sender_name,submission_state,memories(id,slug)").eq("order_number",orderNumber).eq("tracking_token_hash",h).maybeSingle();if(error)throw error;if(!data||data.submission_state!=="complete")return null;const memory=Array.isArray(data.memories)?data.memories[0]:data.memories;return memory?{order:data,memory}:null}
export function extFor(mime:string){const m=mime.toLowerCase();return m==="image/jpeg"?"jpg":m==="image/png"?"png":m==="image/webp"?"webp":m==="audio/webm"?"webm":m==="audio/ogg"?"ogg":m==="audio/mpeg"?"mp3":m==="audio/mp4"||m==="audio/x-m4a"?"m4a":"bin"}
