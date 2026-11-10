import { admin, cors, gatewayOk, out, rateAllowed, sha256Text, trustedIp, verifyTracking } from "../_shared/wow.ts";

const SLUG=/^m-[a-f0-9]{16}(?:[a-f0-9]{16})?$/i;
const SESSION=/^[A-Za-z0-9_-]{16,96}$/;

async function memoryForSlug(slug:string){
  const {data,error}=await admin.from("memories").select("id,slug,is_published").eq("slug",slug).eq("is_published",true).maybeSingle();
  if(error)throw error;
  if(!data)return null;
  const [{data:w,error:we},{data:moment,error:me}]=await Promise.all([
    admin.from("memory_wow").select("enabled").eq("memory_id",data.id).maybeSingle(),
    admin.from("memory_wow_moments").select("id").eq("memory_id",data.id).eq("type","gender_reveal").eq("enabled",true).limit(1)
  ]);
  if(we)throw we;if(me)throw me;
  return w?.enabled&&(moment||[]).length?data:null;
}

async function status(memoryId:string,sessionId:string){
  if(sessionId){
    const sessionHash=await sha256Text(`${memoryId}|${sessionId}`);
    const {error}=await admin.from("wow_gender_presence").upsert({memory_id:memoryId,session_hash:sessionHash,last_seen_at:new Date().toISOString()},{onConflict:"memory_id,session_hash"});
    if(error)throw error;
  }
  const now=new Date();
  const [{data:row,error},{count,error:ce}]=await Promise.all([
    admin.from("wow_gender_reveals").select("result,reveal_at,started_at,revealed_at,revision,updated_at").eq("memory_id",memoryId).maybeSingle(),
    admin.from("wow_gender_presence").select("id",{count:"exact",head:true}).eq("memory_id",memoryId).gte("last_seen_at",new Date(now.getTime()-45000).toISOString())
  ]);
  if(error)throw error;if(ce)throw ce;
  if(!row)return {configured:false,state:"unconfigured",serverNow:now.toISOString(),participants:count||0};
  const at=row.reveal_at?new Date(row.reveal_at).getTime():NaN;
  if(!Number.isFinite(at))return {configured:true,state:"waiting",serverNow:now.toISOString(),participants:count||0,revision:row.revision};
  if(now.getTime()<at)return {configured:true,state:"countdown",serverNow:now.toISOString(),revealAt:row.reveal_at,participants:count||0,revision:row.revision};
  if(!row.revealed_at)admin.from("wow_gender_reveals").update({revealed_at:now.toISOString(),updated_at:now.toISOString()}).eq("memory_id",memoryId).is("revealed_at",null).then(()=>{}).catch(()=>{});
  return {configured:true,state:"revealed",serverNow:now.toISOString(),revealAt:row.reveal_at,participants:count||0,revision:row.revision,result:row.result};
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return out({error:"Method not allowed"},405);
  if(!(await gatewayOk(req)))return out({error:"Gateway required"},403);
  try{
    const body=await req.json(),action=String(body.action||"status").slice(0,20),ip=trustedIp(req);
    if(action==="start"){
      if(!(await rateAllowed("wow-gender-start",ip,12,900)))return out({error:"محاولات كثيرة. حاول بعد قليل."},429);
      const verified=await verifyTracking(String(body.orderNumber||"").trim().slice(0,50),String(body.trackingToken||"").trim().slice(0,160));
      if(!verified)return out({error:"بيانات المتابعة غير صحيحة"},401);
      const memory=await memoryForSlug(String(verified.memory.slug||""));
      if(!memory||memory.id!==verified.memory.id)return out({error:"تجربة الكشف غير مفعّلة"},409);
      const {data,error}=await admin.rpc("wow_schedule_gender_reveal",{p_memory_id:memory.id,p_delay_seconds:12});
      if(error){if(String(error.message).includes("not configured"))return out({error:"حدد النتيجة من محرر الذكرى أولًا"},409);throw error}
      return out({ok:true,...await status(memory.id,"")});
    }
    const slug=String(body.slug||"").trim().slice(0,80),sessionId=String(body.sessionId||"").trim().slice(0,96);
    if(!SLUG.test(slug)||!SESSION.test(sessionId))return out({error:"بيانات جلسة الكشف غير صالحة"},400);
    if(!(await rateAllowed("wow-gender-status-global","GLOBAL",5000,600)))return out({error:"الخدمة مشغولة مؤقتًا. حاول بعد قليل."},429);
    if(!(await rateAllowed("wow-gender-status",`${ip}|${slug}|${sessionId}`,240,600)))return out({error:"تم إيقاف التحديث مؤقتًا. حاول بعد قليل."},429);
    const memory=await memoryForSlug(slug);if(!memory)return out({error:"تجربة الكشف غير متاحة"},404);
    return out(await status(memory.id,sessionId));
  }catch(e){console.error(e);return out({error:"تعذر تحديث لحظة الكشف"},500)}
});
