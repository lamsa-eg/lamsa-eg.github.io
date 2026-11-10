import { admin, clean, cors, gatewayOk, out, verifyTracking } from "../_shared/wow.ts";

const KEYS=new Set(["quiz","story","wheel","coupons","puzzle","memory","order_story","guess_place","scratch","scramble","finish_sentence","true_false","emoji_guess","constellation","open_when","reunion_countdown","balloons","hearts"]);
const TAP_ONLY=new Set(["quiz","balloons","scratch","order_story"]);
const PHOTO=new Set(["puzzle","memory","order_story","guess_place","scratch"]);
const cleanList=(v:any,n=12,max=240)=>(Array.isArray(v)?v:[]).slice(0,n).map(x=>clean(x,max)).filter(Boolean);
function reward(raw:any){const r=raw&&typeof raw==="object"?raw:{};return{type:["message","video","audio","letter","none"].includes(clean(r.type,12))?clean(r.type,12):"message",text:clean(r.text,800),mediaIndex:Number.isInteger(Number(r.mediaIndex))?Number(r.mediaIndex):undefined}}
function generated(key:string,a:any,imageCount:number){
  const common:any={game:key,anchor:"after_gallery",title:"افتح/افتحي الظرف",storyTitle:clean(a?.title,140)||"تفصيلة من حكايتكم",skippable:true,playOnce:true,reward:{type:"message",text:clean(a?.sentence,500)||"المفاجأة دي معمولة مخصوص عشانك ♡"}};
  if(key==="quiz")common.questions=[{q:"مين فيكم بيتأخر أكتر؟",options:[clean(a?.late,80)||"أنا",clean(a?.lateOther,80)||"إنت", "الاتنين"],answer:0,reactions:["بالظبط ♡","قريبة 😄","ممكن برضه!"]}];
  if(key==="story")Object.assign(common,{game:"story",nodes:{start:{text:clean(a?.firstMeet,300)||"أول مرة اتقابلتوا فين؟",choices:[{label:clean(a?.firstNotice,120)||"أول نظرة",next:"one"},{label:clean(a?.favorite,120)||"مكانكم المفضل",next:"two"}]},one:{text:clean(a?.firstNotice,400)||"تفصيلة ما بتتنسيش",title:"البداية",end:true,choices:[]},two:{text:clean(a?.favorite,400)||"مكان له ذكرى",title:"الذكرى",end:true,choices:[]}}});
  if(key==="wheel")common.options=cleanList(a?.promiseOptions?.length?a.promiseOptions:[a?.promise,"خروجة من اختيارك","عشا سوا"],8,120);
  if(key==="coupons")common.items=(cleanList(a?.promiseOptions?.length?a.promiseOptions:[a?.promise],8,140).length?cleanList(a?.promiseOptions?.length?a.promiseOptions:[a?.promise],8,140):["خروجة من اختيارك"]).map((title:string)=>({title,subtitle:"وعد بينكم"}));
  if(key==="scramble")Object.assign(common,{word:clean(a?.insideWord,40)||"حكايتنا",hint:"كلمة بينكم محدش بيفهمها غيركم"});
  if(PHOTO.has(key)){common.imageIndex=Math.max(0,Math.min(imageCount-1,Number(a?.photoIndex||0)));common.autoImage=true}
  return common;
}
function sanitizeMoment(item:any,a:any,imageCount:number,simple:boolean,index:number){
  const key=clean(item?.game||item?.type,30);if(!KEYS.has(key)||simple&&!TAP_ONLY.has(key))return null;
  const source=item?.config&&typeof item.config==="object"?item.config:generated(key,a,imageCount),config:any={...source,game:key,skippable:true,playOnce:true,reward:reward(source.reward)};
  delete config.demo;config.title=clean(config.title,140)||"مفاجأة صغيرة";config.storyTitle=clean(config.storyTitle,140)||config.title;config.anchor=index===0?"after_gallery":"before_end";
  if(config.reward.type==="none")config.reward={type:"message",text:"كل لعبة بينكم وراها مفاجأة ♡"};
  return{type:key==="coupons"?"coupons":"game",config,sort_order:220+index*10,enabled:true};
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return out({error:"Method not allowed"},405);
  if(!(await gatewayOk(req)))return out({error:"Gateway required"},403);
  try{
    const b=await req.json(),v=await verifyTracking(clean(b.orderNumber,50),clean(b.trackingToken,160));if(!v)return out({error:"بيانات الطلب غير صحيحة"},401);
    const{data:o,error:oe}=await admin.from("orders").select("package_id,price,shipping_fee,story_answers,simple_mode,wow_addons").eq("id",v.order.id).single();if(oe)throw oe;
    const answer=b.storyAnswers&&typeof b.storyAnswers==="object"?b.storyAnswers:o.story_answers||{},simple=b.simpleMode===true||o.simple_mode===true,imageCount=Math.max(0,Math.min(20,Number(b.imageCount||0)));
    const addons=(Array.isArray(b.addons)?b.addons:[]).map((x:any)=>clean(x,40)).filter(Boolean),packId=clean(b.occasionPack,40)||null,gender=["m","f"].includes(clean(b.recipientGender,1))?clean(b.recipientGender,1):null;
    const included=o.package_id==="premium"?3:o.package_id==="memory"?2:0,raw=(Array.isArray(b.games)?b.games:[]).slice(0,3),max=Math.min(3,included+(addons.includes("extra_game")?1:0));if(raw.length>max)return out({error:`الباقة تسمح بحد أقصى ${max} ألعاب`},400);
    const hasHunt=addons.includes("hunt_stickers");if(raw.some((x:any)=>clean(x?.game||x?.type,30)==="treasure")&&!hasHunt)return out({error:"صيد الكنز يحتاج إضافة ستيكرات الكنز"},400);
    const seen=new Set(),items:any[]=[];for(const x of raw){const k=clean(x?.game||x?.type,30);if(seen.has(k))continue;seen.add(k);const m=sanitizeMoment(x,answer,imageCount,simple,items.length);if(m)items.push(m)}
    const now=new Date().toISOString(),memoryId=v.memory.id;
    const[{data:addonRows},{data:packRow}]=await Promise.all([admin.from("wow_addons").select("id,label,price").in("id",addons).eq("active",true),packId?admin.from("wow_packs").select("id,label,price").eq("id",packId).eq("active",true).maybeSingle():Promise.resolve({data:null})]);
    const wowPrice=(addonRows||[]).reduce((n:number,x:any)=>n+Number(x.price||0),0)+Number(packRow?.price||0),pricing={games:items.length,included,addons:(addonRows||[]).map((x:any)=>({id:x.id,label:x.label,price:Number(x.price)})),pack:packRow?{id:packRow.id,label:packRow.label,price:Number(packRow.price)}:null,total:wowPrice};
    const referral=`LAMSA10-${String(v.order.id).replaceAll("-","").slice(0,6).toUpperCase()}`;
    const{error:orderUpdate}=await admin.from("orders").update({recipient_gender:gender,story_answers:answer,simple_mode:simple,wow_pack_id:packId,wow_addons:addons,wow_price:wowPrice,wow_pricing:pricing,occasion_pack:packId,referral_code:referral,total_amount:Number(o.price||0)+Number(o.shipping_fee||0)+wowPrice}).eq("id",v.order.id);if(orderUpdate)throw orderUpdate;
    const{error:memoryUpdate}=await admin.from("memories").update({recipient_gender:gender,simple_mode:simple,referral_code:referral}).eq("id",memoryId);if(memoryUpdate)throw memoryUpdate;
    await admin.from("wow_referrals").upsert({code:referral,order_id:v.order.id,discount_percent:10,active:true},{onConflict:"code"});
    const{error:up}=await admin.from("memory_wow").upsert({memory_id:memoryId,enabled:items.length>0,pack:"story_v35",theme:null,gates:{wax_seal:{enabled:items.length>0}},updated_at:now},{onConflict:"memory_id"});if(up)throw up;
    const{error:del}=await admin.from("memory_wow_moments").delete().eq("memory_id",memoryId).in("type",["game","treasure","coupons"]);if(del)throw del;
    if(items.length){const{error:ins}=await admin.from("memory_wow_moments").insert(items.map(x=>({memory_id:memoryId,...x,updated_at:now})));if(ins)throw ins}
    await admin.from("order_events").insert({order_id:v.order.id,event_type:"wow_story_generated",details:{games:[...seen],count:items.length,simple_mode:simple}});
    return out({ok:true,count:items.length,games:[...seen],wowPrice,pricing,totalAmount:Number(o.price||0)+Number(o.shipping_fee||0)+wowPrice});
  }catch(e){console.error(e);return out({error:"تعذر تجهيز ألعاب الحكاية"},500)}
});
