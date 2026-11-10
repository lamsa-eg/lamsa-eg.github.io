
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm";
import { cfg, configured } from "./common-cf-v4.js";
let client=null;
export function db(){
  if(!configured()) return null;
  if(!client){
    const c=cfg();
    client=createClient(c.SUPABASE_URL,c.SUPABASE_PUBLISHABLE_KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
  }
  return client;
}
async function postJson(url,body,headers){
  const r=await fetch(url,{method:"POST",headers,body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  return {r,data};
}
export async function functionPost(name, body, jwt){
  if(!configured()) throw new Error("LAMSA غير مربوط بـ Supabase بعد.");
  const headers={"Content-Type":"application/json","x-lamsa-form-version":"2"};
  if(jwt) headers.Authorization=`Bearer ${jwt}`;
  try{
    const {r,data}=await postJson(window.LAMSA_API(name),body,window.LAMSA_API_HEADERS(headers));
    if(!r.ok){const err=new Error(data.error||`Request failed (${r.status})`);err.status=r.status;err.data=data;throw err;}
    return data;
  }catch(e){
    if(e instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(String(e?.message||""))){
      throw new Error("تعذر الاتصال بخدمة LAMSA. تأكد من الإنترنت وافتح النسخة المنشورة على Cloudflare Pages.");
    }
    throw e;
  }
}
export async function requireAdmin(){
  const s=db(); if(!s){location.href="./login.html?setup=1";return null;}
  const {data:{session},error:sessionError}=await s.auth.getSession();
  if(sessionError||!session){location.href="./login.html";return null;}
  const {data:profile,error}=await s.from("admin_profiles").select("user_id,display_name,role").eq("user_id",session.user.id).maybeSingle();
  if(error){console.error(error);return null}
  if(!profile){await s.auth.signOut();location.href="./login.html?denied=1";return null}
  return {session,profile};
}
