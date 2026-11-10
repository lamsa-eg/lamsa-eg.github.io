import { admin, cors, gatewayOk, out, rateAllowed, trustedIp, verifyToken } from "../_shared/wow.ts";

const STATEFUL=new Set(["open_notify","reply","mirror","open_when","future_messages","burn_message","game","treasure","coupons","group_gift","proposal","apology","gender_reveal","fanous"]);
function validSlug(slug:string){return /^m-[a-f0-9]{16}(?:[a-f0-9]{16})?$/i.test(slug)}
function sanitizeGates(raw:any){const g=raw&&typeof raw==="object"?raw:{};return{
  wax_seal:{enabled:g.wax_seal?.enabled===true,initials:String(g.wax_seal?.initials||"").slice(0,12),label:String(g.wax_seal?.label||"").slice(0,180)},
  locked:{enabled:g.locked?.enabled===true,unlock_at:g.locked?.unlock_at||null},
  secret_question:{enabled:g.secret_question?.enabled===true,question:String(g.secret_question?.question||"").slice(0,300),hint:String(g.secret_question?.hint||"").slice(0,300)}
}}
function publicMoment(x:any){
  const config=x?.config&&typeof x.config==="object"?structuredClone(x.config):{};
  if(config.reward){config.rewardLocked=true;delete config.reward}
  if(x?.type==="gender_reveal"){
    for(const key of ["result","gender","secret","answer","boy","girl","value"])delete config[key];
    config.title=String(config.title||"").slice(0,140);
    config.subtitle=String(config.subtitle||"").slice(0,320);
    config.girlLabel=String(config.girlLabel||"").slice(0,100);
    config.boyLabel=String(config.boyLabel||"").slice(0,100);
    config.girlMessage=String(config.girlMessage||"").slice(0,300);
    config.boyMessage=String(config.boyMessage||"").slice(0,300);
  }
  return{id:x.id,type:x.type,config,sortOrder:x.sort_order,enabled:x.enabled};
}
async function signRows(rows:any[],ttl=3600){const groups=new Map<string,any[]>(),ordered=(rows||[]).map((row:any,position:number)=>({...row,__position:position}));for(const row of ordered){const bucket=row.storage_bucket||"memory-media",a=groups.get(bucket)||[];a.push(row);groups.set(bucket,a)}const parts=await Promise.all([...groups.entries()].map(async([bucket,items])=>{const{data,error}=await admin.storage.from(bucket).createSignedUrls(items.map(x=>x.storage_path),ttl);if(error){console.error("batch-sign",bucket,error);return[]}return(data||[]).map((s:any,i:number)=>s?.signedUrl&&items[i]?{kind:items[i].kind,caption:items[i].caption||null,sortOrder:items[i].sort_order,url:s.signedUrl,__position:items[i].__position}:null).filter(Boolean)}));return parts.flat().sort((a:any,b:any)=>a.__position-b.__position).map(({__position,...row}:any)=>row)}
function baseResponse(m:any,media:any[]){return{slug:m.slug,senderName:m.sender_name,recipientName:m.recipient_name,recipientGender:m.recipient_gender||null,simpleMode:m.simple_mode===true,referralCode:m.referral_code||null,memoryDate:m.memory_date,occasion:m.occasion||"",intro:m.intro||"",message:m.message||"",songTitle:m.song_title||"",songUrl:m.song_url||"",theme:m.theme||"black_rose",pageCopy:m.page_copy||{},advanced:m.advanced_customization||{},media}}
async function coverOnly(memoryId:string){const{data,error}=await admin.from("memory_media").select("kind,storage_bucket,storage_path,caption,sort_order").eq("memory_id",memoryId).order("sort_order");if(error)throw error;const rows=data||[],pick=rows.find(x=>x.kind==="cover"||x.caption==="cover-photo"||x.kind==="logo")||rows.find(x=>x.kind==="image");return pick?await signRows([pick],900):[]}
async function allMedia(memoryId:string){const{data,error}=await admin.from("memory_media").select("kind,storage_bucket,storage_path,caption,sort_order,created_at").eq("memory_id",memoryId).order("sort_order").order("created_at");if(error)throw error;return signRows(data||[],3600)}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return out({error:"Method not allowed"},405);
  if(!(await gatewayOk(req)))return out({error:"Gateway required"},403);
  try{
    if(!(await rateAllowed("public-memory-global","GLOBAL",1500,600)))return out({error:"الخدمة مشغولة مؤقتًا. حاول بعد قليل."},429);
    if(!(await rateAllowed("public-memory",`${trustedIp(req)}|${(req.headers.get("x-lamsa-client-ua")||"").slice(0,180)}`,120,600)))return out({error:"محاولات كثيرة. حاول بعد قليل."},429);
    const b=await req.json(),slug=String(b.slug||"").trim().slice(0,80),wowToken=String(b.wowToken||"").trim().slice(0,2000);
    if(!validSlug(slug))return out({error:"Invalid memory"},400);
    const{data:m,error}=await admin.from("memories").select("id,slug,sender_name,recipient_name,recipient_gender,simple_mode,referral_code,memory_date,occasion,intro,message,song_title,song_url,theme,page_copy,advanced_customization,is_published").eq("slug",slug).eq("is_published",true).maybeSingle();
    if(error)throw error;if(!m)return out({error:"Memory not found"},404);
    const wowFeature=req.headers.get("x-lamsa-wow-enabled")==="1";
    if(!wowFeature){return out(baseResponse(m,await allMedia(m.id)))}
    const{data:w,error:we}=await admin.from("memory_wow").select("enabled,pack,theme,gates,updated_at").eq("memory_id",m.id).maybeSingle();
    if(we)throw we;if(!w?.enabled){return out(baseResponse(m,await allMedia(m.id)))}
    const gates=sanitizeGates(w.gates),now=Date.now(),serverNow=new Date(now).toISOString(),unlockAt=gates.locked.unlock_at?new Date(gates.locked.unlock_at).getTime():NaN,locked=gates.locked.enabled&&Number.isFinite(unlockAt)&&now<unlockAt;
    const secretEnabled=gates.secret_question.enabled;let secretUnlocked=!secretEnabled;
    if(secretEnabled&&wowToken){secretUnlocked=!!(await verifyToken(wowToken,{slug}))}
    if(locked){const minimal:any={slug:m.slug,senderName:m.sender_name,recipientName:m.recipient_name,recipientGender:m.recipient_gender||null,simpleMode:m.simple_mode===true,media:await coverOnly(m.id),wow:{enabled:true,gateState:{locked:true,unlockAt:gates.locked.unlock_at||null,secretRequired:false},gates:{locked:gates.locked},moments:[],cacheable:false,serverNow}};return out(minimal)}
    if(!secretUnlocked){const minimal:any={slug:m.slug,senderName:m.sender_name,recipientName:m.recipient_name,recipientGender:m.recipient_gender||null,simpleMode:m.simple_mode===true,media:await coverOnly(m.id),wow:{enabled:true,pack:w.pack||null,theme:w.theme||null,gates:{secret_question:gates.secret_question},gateState:{locked:false,unlockAt:null,secretRequired:true},moments:[],cacheable:false,serverNow}};return out(minimal)}
    const[{data:moments,error:moe},media]=await Promise.all([admin.from("memory_wow_moments").select("id,type,config,sort_order,enabled").eq("memory_id",m.id).eq("enabled",true).order("sort_order"),allMedia(m.id)]);if(moe)throw moe;
    const anyGate=gates.wax_seal.enabled||gates.locked.enabled||gates.secret_question.enabled,anyStateful=(moments||[]).some((x:any)=>STATEFUL.has(x.type)),cacheable=!(anyGate||anyStateful);
    return out({...baseResponse(m,media),wow:{enabled:true,pack:w.pack||null,theme:w.theme||null,gates,gateState:{locked:false,unlockAt:gates.locked.unlock_at||null,secretRequired:false},moments:(moments||[]).map(publicMoment),cacheable,serverNow}})
  }catch(e){console.error(e);return out({error:"تعذر فتح الذكرى"},500)}
});
