import { admin,cors,gatewayOk,out,verifyTracking } from "../_shared/wow.ts";

async function features(memoryId:string){
  const {data:w,error}=await admin.from("memory_wow").select("enabled").eq("memory_id",memoryId).maybeSingle();
  if(error)throw error;if(!w?.enabled)return{openNotify:false,genderReveal:false};
  const {data,error:me}=await admin.from("memory_wow_moments").select("type").eq("memory_id",memoryId).eq("enabled",true).in("type",["open_notify","gender_reveal"]);
  if(me)throw me;const types=new Set((data||[]).map((x:any)=>x.type));
  return{openNotify:types.has("open_notify"),genderReveal:types.has("gender_reveal")};
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return out({error:"Method not allowed"},405);
  if(!(await gatewayOk(req)))return out({error:"Gateway required"},403);
  try{
    const b=await req.json(),verified=await verifyTracking(String(b.orderNumber||"").trim().slice(0,50),String(b.trackingToken||"").trim().slice(0,160));
    if(!verified)return out({error:"بيانات المتابعة غير صحيحة"},401);
    const f=await features(verified.memory.id),{data:set,error:se}=await admin.from("notification_settings").select("vapid_public_key").eq("id","default").maybeSingle();if(se)throw se;
    if(String(b.action||"config")==="config")return out({enabled:f.openNotify,vapidPublicKey:f.openNotify?String(set?.vapid_public_key||""):"",genderReveal:f.genderReveal,slug:verified.memory.slug});
    if(!f.openNotify)return out({error:"إشعار الفتح مش مفعّل للذكرى دي"},409);
    const sub=b.subscription||{},endpoint=String(sub.endpoint||"").trim(),p256dh=String(sub.keys?.p256dh||"").trim(),auth=String(sub.keys?.auth||"").trim();
    if(!endpoint||!p256dh||!auth)return out({error:"بيانات الإشعار غير مكتملة"},400);
    if(b.action==="subscribe"){
      const{error}=await admin.from("wow_sender_subscriptions").upsert({memory_id:verified.memory.id,endpoint,p256dh,auth,active:true,user_agent:String(req.headers.get("user-agent")||"").slice(0,300),updated_at:new Date().toISOString()},{onConflict:"memory_id,endpoint"});if(error)throw error;return out({ok:true});
    }
    if(b.action==="unsubscribe"){
      const{error}=await admin.from("wow_sender_subscriptions").update({active:false,updated_at:new Date().toISOString()}).eq("memory_id",verified.memory.id).eq("endpoint",endpoint);if(error)throw error;return out({ok:true});
    }
    return out({error:"إجراء غير صالح"},400);
  }catch(e){console.error(e);return out({error:"تعذر تحديث إعدادات WOW"},500)}
});
