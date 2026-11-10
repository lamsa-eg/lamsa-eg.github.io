import { admin, clean, cors, gatewayOk, out, verifyTracking } from "../_shared/wow.ts";
import { sanitize } from "../_shared/game-sanitize.ts";

const managedTypes=["game","treasure","coupons"];

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return out({error:"Method not allowed"},405);
  if(!(await gatewayOk(req)))return out({error:"Gateway required"},403);
  try{
    const body=await req.json(),verified=await verifyTracking(clean(body.orderNumber,50),clean(body.trackingToken,160));
    if(!verified)return out({error:"بيانات الطلب غير صحيحة"},401);
    const raw=Array.isArray(body.games)?body.games:[];if(raw.length>4)return out({error:"عدد الألعاب أكبر من المسموح"},400);
    const build=raw.find((x:any)=>x?.config?.__storyBuild)?.config?.__storyBuild||{};
    const chosen=raw.filter((x:any)=>x?.game!=="setup").slice(0,3);
    const seen=new Set<string>(),items=[];
    for(let i=0;i<chosen.length;i++){const key=clean(chosen[i]?.game,20);if(seen.has(key))continue;seen.add(key);const item=sanitize(chosen[i],i);if(!item)return out({error:`بيانات لعبة ${key||i+1} غير مكتملة`},400);items.push(item)}
    const memoryId=verified.memory.id,now=new Date().toISOString();
    const addons=(Array.isArray(build.addons)?build.addons:[]).map((x:any)=>clean(x,40)).filter(Boolean),packId=clean(build.occasionPack,40)||null,gender=["m","f"].includes(clean(build.recipientGender,1))?clean(build.recipientGender,1):null,simple=build.simpleMode===true,answers=build.storyAnswers&&typeof build.storyAnswers==="object"?build.storyAnswers:{};
    const{data:order,error:orderError}=await admin.from("orders").select("package_id,price,shipping_fee").eq("id",verified.order.id).single();if(orderError)throw orderError;
    // packages.max_games (migration v38) is the source of truth; legacy rule as fallback.
    let included=order.package_id==="premium"?3:order.package_id==="memory"?2:0;{const{data:pk,error:pe}=await admin.from("packages").select("max_games").eq("id",order.package_id).maybeSingle();if(!pe&&pk&&pk.max_games!==null&&pk.max_games!==undefined)included=Math.max(0,Math.min(3,Number(pk.max_games)))}
    const max=Math.min(3,included+(addons.includes("extra_game")?1:0));if(items.length>max)return out({error:`الباقة تسمح بحد أقصى ${max} ألعاب`},400);
    if(seen.has("treasure")&&!addons.includes("hunt_stickers"))return out({error:"صيد الكنز يحتاج إضافة ستيكرات الكنز"},400);
    const[{data:addonRows},{data:packRow}]=await Promise.all([admin.from("wow_addons").select("id,label,price").in("id",addons).eq("active",true),packId?admin.from("wow_packs").select("id,label,price").eq("id",packId).eq("active",true).maybeSingle():Promise.resolve({data:null})]);const wowPrice=(addonRows||[]).reduce((n:number,x:any)=>n+Number(x.price||0),0)+Number(packRow?.price||0),pricing={games:items.length,included,addons:addonRows||[],pack:packRow||null,total:wowPrice},referral=`LAMSA10-${String(verified.order.id).replaceAll("-","").slice(0,6).toUpperCase()}`;
    const{error:ou}=await admin.from("orders").update({recipient_gender:gender,story_answers:answers,simple_mode:simple,wow_pack_id:packId,wow_addons:addons,wow_price:wowPrice,wow_pricing:pricing,occasion_pack:packId,referral_code:referral,total_amount:Number(order.price||0)+Number(order.shipping_fee||0)+wowPrice}).eq("id",verified.order.id);if(ou)throw ou;const{error:mu}=await admin.from("memories").update({recipient_gender:gender,simple_mode:simple,referral_code:referral}).eq("id",memoryId);if(mu)throw mu;await admin.from("wow_referrals").upsert({code:referral,order_id:verified.order.id,discount_percent:10,active:true},{onConflict:"code"});
    const{error:up}=await admin.from("memory_wow").upsert({memory_id:memoryId,enabled:items.length>0,pack:"wow_customer_choice",theme:null,gates:{},updated_at:now},{onConflict:"memory_id"});if(up)throw up;
    const{error:del}=await admin.from("memory_wow_moments").delete().eq("memory_id",memoryId).in("type",managedTypes);if(del)throw del;
    if(items.length){const{error:ins}=await admin.from("memory_wow_moments").insert(items.map(x=>({memory_id:memoryId,...x,updated_at:now})));if(ins)throw ins}
    await admin.from("order_events").insert({order_id:verified.order.id,event_type:"wow_games_selected_by_customer",details:{games:[...seen],count:items.length}});
    return out({ok:true,memoryId,games:[...seen],count:items.length,wowPrice,totalAmount:Number(order.price||0)+Number(order.shipping_fee||0)+wowPrice});
  }catch(e){console.error(e);return out({error:"تعذر حفظ اختيارات الألعاب"},500)}
});
