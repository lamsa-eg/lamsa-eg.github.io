import { actor, admin, clean, cors, gatewayOk, normalizeSecretAnswer, out, sha256Text } from "../_shared/wow.ts";

const TYPES=new Set(["live_counter","typewriter_letter","first_chat","mirror","reply","open_notify","gender_reveal","game","treasure","coupons"]);
const GAMES=new Set(["quiz","puzzle","hearts","memory","balloons","story","wheel","order_story","guess_place","scratch","scramble","finish_sentence","true_false","emoji_guess","constellation","open_when","reunion_countdown","love_wrapped","remote_touch"]);
const ANCHORS=new Set(["before_page","after_cover","after_message","after_gallery","before_end"]);
function rand(n=18){const b=crypto.getRandomValues(new Uint8Array(n));return[...b].map(x=>x.toString(16).padStart(2,"0")).join("")}
function safeUrl(v:any,max=700){const s=clean(v,max);try{if(s.startsWith("/")&&!s.startsWith("//")){const u=new URL(s,"https://lamsa.invalid");return`${u.pathname}${u.search}`.slice(0,max)}const u=new URL(s);return u.protocol==="https:"?u.href.slice(0,max):""}catch{return""}}
function reward(raw:any){const r=raw&&typeof raw==="object"?raw:{};const type=["none","message","photo","video"].includes(clean(r.type,12))?clean(r.type,12):"none",mediaIndex=Number(r.mediaIndex);return{type,text:clean(r.text,800),src:safeUrl(r.src),poster:safeUrl(r.poster),caption:clean(r.caption,400),...(Number.isInteger(mediaIndex)&&mediaIndex>=0&&mediaIndex<100?{mediaIndex}:{})}}
function baseInteractive(c:any){return{anchor:ANCHORS.has(clean(c.anchor,30))?clean(c.anchor,30):"before_end",title:clean(c.title,140),sub:clean(c.sub,320)}}
function gameConfig(raw:any){
  const c=raw&&typeof raw==="object"?raw:{},game=clean(c.game,20);if(!GAMES.has(game))return null;
  const out:any={...c,...baseInteractive(c),game,winText:clean(c.winText,300),lockLabel:clean(c.lockLabel,240),skipLabel:clean(c.skipLabel,120),skippable:c.skippable!==false,playOnce:c.playOnce!==false,hideGameOnWin:c.hideGameOnWin===true,skipAfterSec:Math.max(0,Math.min(120,Number(c.skipAfterSec??30))),skipAfterFails:Math.max(1,Math.min(10,Number(c.skipAfterFails||2))),reward:reward(c.reward)};
  if(game==="quiz"){out.perfect=clean(c.perfect,240);out.good=clean(c.good,240);out.bad=clean(c.bad,240);out.questions=(Array.isArray(c.questions)?c.questions:[]).slice(0,12).map((q:any)=>{const options=(Array.isArray(q?.options)?q.options:[]).slice(0,6).map((x:any)=>clean(x,160)).filter(Boolean),answer=Math.max(0,Math.min(options.length-1,Number(q?.answer||0)));return{q:clean(q?.q,300),options,answer,reactions:(Array.isArray(q?.reactions)?q.reactions:[]).slice(0,options.length).map((x:any)=>clean(x,240))}}).filter((q:any)=>q.q&&q.options.length>=2)}
  if(game==="puzzle"){const imageIndex=Number(c.imageIndex);out.image=safeUrl(c.image);if(Number.isInteger(imageIndex)&&imageIndex>=0&&imageIndex<100)out.imageIndex=imageIndex;out.size=Math.max(2,Math.min(4,Number(c.size||3)))}
  if(game==="hearts"){out.target=Math.max(5,Math.min(60,Number(c.target||15)));out.seconds=Math.max(10,Math.min(90,Number(c.seconds||25)))}
  if(game==="memory"){out.images=(Array.isArray(c.images)?c.images:[]).slice(0,8).map((x:any)=>safeUrl(x)).filter(Boolean);out.imageIndexes=(Array.isArray(c.imageIndexes)?c.imageIndexes:[]).slice(0,8).map((x:any)=>Number(x)).filter((x:any)=>Number.isInteger(x)&&x>=0&&x<100)}
  if(game==="balloons")out.lines=(Array.isArray(c.lines)?c.lines:[]).slice(0,12).map((x:any)=>clean(x,240)).filter(Boolean);
  if(game==="wheel")out.options=(Array.isArray(c.options)?c.options:[]).slice(0,12).map((x:any)=>clean(x,120)).filter(Boolean);
  if(game==="story"){
    out.start=clean(c.start,40);out.nodes={};
    for(const [key,node] of Object.entries(c.nodes&&typeof c.nodes==="object"?c.nodes:{}).slice(0,20)){const id=clean(key,40);if(!/^[a-z0-9_-]+$/i.test(id))continue;const n:any=node||{};out.nodes[id]={text:clean(n.text,600),title:clean(n.title,120),end:n.end===true,choices:(Array.isArray(n.choices)?n.choices:[]).slice(0,6).map((x:any)=>({label:clean(x?.label,180),next:clean(x?.next,40)})).filter((x:any)=>x.label&&/^[a-z0-9_-]+$/i.test(x.next))}}
  }
  return out;
}
function treasureConfig(raw:any){const c=raw&&typeof raw==="object"?raw:{};return{...baseInteractive(c),finalTitle:clean(c.finalTitle,160),finalText:clean(c.finalText,600),clues:(Array.isArray(c.clues)?c.clues:[]).slice(0,12).map((x:any)=>({text:clean(x?.text,400),hint:clean(x?.hint,300)})).filter((x:any)=>x.text)}}
function couponsConfig(raw:any){const c=raw&&typeof raw==="object"?raw:{};return{...baseInteractive(c),items:(Array.isArray(c.items)?c.items:[]).slice(0,12).map((x:any)=>({title:clean(x?.title,140),subtitle:clean(x?.subtitle,240)})).filter((x:any)=>x.title)}}

function sanitize(moment:any){
  const type=clean(moment?.type,64);if(!TYPES.has(type))return null;
  let c=moment?.config&&typeof moment.config==="object"?structuredClone(moment.config):{};
  c.anchor=ANCHORS.has(clean(c.anchor,30))?clean(c.anchor,30):"before_end";
  if(type==="live_counter"){c.since=clean(c.since,60);c.label=clean(c.label,120)}
  else if(type==="typewriter_letter"){c.text=clean(c.text,6000);c.signature=clean(c.signature,120);c.speedMs=Math.max(12,Math.min(120,Number(c.speedMs||32)))}
  else if(type==="first_chat"){c.messages=(Array.isArray(c.messages)?c.messages:[]).slice(0,120).map((x:any)=>({sender:clean(x?.sender,80),text:clean(x?.text,1000),time:clean(x?.time,40)})).filter((x:any)=>x.text);c.closingLine=clean(c.closingLine,300)}
  else if(type==="mirror")c.caption=clean(c.caption,140);
  else if(type==="reply"){c.title=clean(c.title,120);c.prompt=clean(c.prompt,300)}
  else if(type==="gender_reveal"){
    c.title=clean(c.title,140);c.subtitle=clean(c.subtitle,320);c.girlLabel=clean(c.girlLabel,100);c.boyLabel=clean(c.boyLabel,100);c.girlMessage=clean(c.girlMessage,300);c.boyMessage=clean(c.boyMessage,300);
    delete c.result;delete c.gender;delete c.secret;delete c.answer;
  }
  else if(type==="game"){c=gameConfig(c);if(!c)return null}
  else if(type==="treasure")c=treasureConfig(c);
  else if(type==="coupons")c=couponsConfig(c);
  return{type,config:c,sort_order:Math.max(-1000,Math.min(1000,Number(moment?.sortOrder||0))),enabled:moment?.enabled!==false};
}

async function readConfig(memoryId:string){
  const [{data:w,error:we},{data:ms,error:me},{data:m,error:mm},{data:gender,error:ge}]=await Promise.all([
    admin.from("memory_wow").select("enabled,pack,theme,gates,updated_at").eq("memory_id",memoryId).maybeSingle(),
    admin.from("memory_wow_moments").select("id,type,config,sort_order,enabled").eq("memory_id",memoryId).order("sort_order"),
    admin.from("memories").select("slug").eq("id",memoryId).maybeSingle(),
    admin.from("wow_gender_reveals").select("result,reveal_at,started_at,revealed_at,revision,updated_at").eq("memory_id",memoryId).maybeSingle()
  ]);
  if(we)throw we;if(me)throw me;if(mm)throw mm;if(ge)throw ge;
  const gates=structuredClone(w?.gates||{});
  if(gates.secret_question)gates.secret_question={enabled:!!gates.secret_question.enabled,question:clean(gates.secret_question.question,300),hint:clean(gates.secret_question.hint,300),configured:!!gates.secret_question.answer_hash};
  return{
    slug:m?.slug||"",
    wow:{enabled:!!w?.enabled,pack:w?.pack||null,theme:w?.theme||null,gates,updatedAt:w?.updated_at||null},
    moments:(ms||[]).map((x:any)=>({id:x.id,type:x.type,config:x.config||{},sortOrder:x.sort_order,enabled:x.enabled})),
    genderReveal:gender?{configured:true,result:gender.result,revealAt:gender.reveal_at,startedAt:gender.started_at,revealedAt:gender.revealed_at,revision:gender.revision}:{configured:false}
  };
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return out({error:"Method not allowed"},405);
  if(!(await gatewayOk(req)))return out({error:"Gateway required"},403);
  try{
    const auth=await actor(req);if(!auth)return out({error:"غير مصرح"},401);
    const b=await req.json(),action=clean(b.action,20),memoryId=clean(b.memoryId,50);
    if(!/^[0-9a-f-]{36}$/i.test(memoryId))return out({error:"معرّف الذكرى غير صالح"},400);
    const{data:mem,error:memErr}=await admin.from("memories").select("id,slug,order_id").eq("id",memoryId).maybeSingle();
    if(memErr)throw memErr;if(!mem)return out({error:"الذكرى غير موجودة"},404);
    if(action==="get")return out(await readConfig(memoryId));
    if(action!=="save")return out({error:"إجراء غير صالح"},400);

    const enabled=b.enabled===true,pack=clean(b.pack,80)||null,theme=clean(b.theme,80)||null;
    const g=b.gates&&typeof b.gates==="object"?b.gates:{};
    const {data:old}=await admin.from("memory_wow").select("gates").eq("memory_id",memoryId).maybeSingle();
    const oldSecret=old?.gates?.secret_question||{},answer=normalizeSecretAnswer(g.secret_question?.answer);
    const secret:any={enabled:g.secret_question?.enabled===true,question:clean(g.secret_question?.question,300),hint:clean(g.secret_question?.hint,300)};
    if(secret.enabled){
      if(answer){const salt=rand();secret.salt=salt;secret.answer_hash=await sha256Text(salt+"|"+answer)}
      else if(oldSecret?.salt&&oldSecret?.answer_hash){secret.salt=oldSecret.salt;secret.answer_hash=oldSecret.answer_hash}
      else return out({error:"اكتب إجابة سؤال السر أول مرة."},400);
    }
    const lockedAt=clean(g.locked?.unlock_at,80);
    if(g.locked?.enabled===true&&(!lockedAt||!Number.isFinite(new Date(lockedAt).getTime())))return out({error:"ميعاد فتح الذكرى غير صالح"},400);
    const gates={wax_seal:{enabled:g.wax_seal?.enabled===true,label:clean(g.wax_seal?.label,180),initials:clean(g.wax_seal?.initials,12)},locked:{enabled:g.locked?.enabled===true,unlock_at:lockedAt||null},secret_question:secret};
    const items=(Array.isArray(b.moments)?b.moments:[]).map(sanitize).filter(Boolean);
    if(items.length>20)return out({error:"عدد لحظات واو أكبر من المسموح"},400);

    const hasGender=items.some((x:any)=>x.type==="gender_reveal"&&x.enabled!==false);
    if(hasGender){
      const requested=clean(b.genderReveal?.result,10);
      const {data:current,error:currentError}=await admin.from("wow_gender_reveals").select("result,revision").eq("memory_id",memoryId).maybeSingle();
      if(currentError)throw currentError;
      const result=requested||current?.result||"";
      if(!["boy","girl"].includes(result))return out({error:"حدد نتيجة كشف نوع المولود أولًا"},400);
      const changed=!!current&&current.result!==result;
      const row:any={memory_id:memoryId,result,updated_at:new Date().toISOString()};
      if(!current||changed){row.reveal_at=null;row.started_at=null;row.revealed_at=null;row.revision=Number(current?.revision||0)+1}
      const {error:genderError}=await admin.from("wow_gender_reveals").upsert(row,{onConflict:"memory_id"});if(genderError)throw genderError;
    }

    const {error:up}=await admin.from("memory_wow").upsert({memory_id:memoryId,enabled,pack,theme,gates,updated_at:new Date().toISOString()},{onConflict:"memory_id"});if(up)throw up;
    const {error:del}=await admin.from("memory_wow_moments").delete().eq("memory_id",memoryId);if(del)throw del;
    if(items.length){const{error:insertError}=await admin.from("memory_wow_moments").insert(items.map((x:any)=>({memory_id:memoryId,...x,updated_at:new Date().toISOString()})));if(insertError)throw insertError}
    await admin.from("order_events").insert({order_id:mem.order_id,event_type:"wow_config_updated",details:{enabled,pack,theme,moments:items.map((x:any)=>x.type)},created_by:auth.user.id});
    return out({ok:true,slug:mem.slug,...await readConfig(memoryId)});
  }catch(e){console.error(e);return out({error:"تعذر حفظ إعدادات لمسة واو"},500)}
});
