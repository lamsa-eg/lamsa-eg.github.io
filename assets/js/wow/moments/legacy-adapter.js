import {receiverCopy} from "../copy-v35.js";

const registry={};
const loaded=new Map();
let cssReady=false;

function addGamesCss(){
  if(cssReady||document.querySelector('link[data-wow-games]'))return;
  cssReady=true;
  const link=document.createElement("link");
  link.rel="stylesheet";link.href="/assets/css/wow-games.css";link.dataset.wowGames="1";
  document.head.appendChild(link);
  const v35=document.createElement("link");v35.rel="stylesheet";v35.href="/assets/css/wow-games-v35.css";document.head.appendChild(v35);
  const v36=document.createElement("link");v36.rel="stylesheet";v36.href="/assets/css/wow-games-v36.css";document.head.appendChild(v36);
}

function legacyGlobal(){
  if(!window.LAMSA_WOW||window.LAMSA_WOW.__productionLegacy!==true){
    window.LAMSA_WOW={__productionLegacy:true,register(type,factory){registry[type]=factory}};
  }
  return window.LAMSA_WOW;
}

function loadFactory(type){
  if(registry[type])return Promise.resolve(registry[type]);
  if(loaded.has(type))return loaded.get(type);
  const job=new Promise((resolve,reject)=>{
    legacyGlobal();
    const script=document.createElement("script");
    script.src=`/assets/js/wow/legacy/moments/${encodeURIComponent(type)}.js`;
    script.async=true;
    script.onload=()=>registry[type]?resolve(registry[type]):reject(new Error(`WOW module did not register: ${type}`));
    script.onerror=()=>reject(new Error(`WOW module failed to load: ${type}`));
    document.head.appendChild(script);
  });
  loaded.set(type,job);return job;
}

function store(slug,id){
  const key=`lamsa-wow-game:${slug}`;
  const read=()=>{try{return JSON.parse(localStorage.getItem(key)||"{}")||{}}catch{return{}}};
  return{get(){return read()[id]},set(value){try{const all=read();all[id]=value;localStorage.setItem(key,JSON.stringify(all))}catch{}}};
}

function tpl(value,vars={}){return String(value||"").replace(/\{(\w+)\}/g,(_,key)=>vars[key]??"")}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node}
function shareCard(kind,vars){const c=document.createElement("canvas");c.width=1080;c.height=1080;const x=c.getContext("2d"),g=x.createLinearGradient(0,0,1080,1080);g.addColorStop(0,"#1b1015");g.addColorStop(1,"#6f3b4a");x.fillStyle=g;x.fillRect(0,0,1080,1080);x.textAlign="center";x.fillStyle="#f5d9df";x.font="700 58px Tahoma";x.fillText(kind==="puzzle"?`حليت البازل في ${vars.seconds||"وقت قياسي"} 💗`:"كسبت تحدي لمسة 💗",540,480);x.fillStyle="#e3bd7f";x.font="46px Georgia";x.fillText("LAMSA · لمسة",540,600);const a=document.createElement("a");a.download="lamsa-wow.png";a.href=c.toDataURL("image/png");a.click()}

function context(memory,moment,core,root){
  const state=store(memory.slug,moment.id);
  return{memory,id:moment.id,config:moment.config||{},root,ar:core.arDigits,vib:core.haptic,esc:core.escapeHtml,mountTurnstile:core.mountTurnstile,toast:core.toast,h(tag,cls,html){const node=document.createElement(tag);if(cls)node.className=cls;if(html!==undefined)node.innerHTML=html;return node},reduce:core.reducedMotion(),confetti(count,colors){core.confetti({count:Number(count)||72,palette:Array.isArray(colors)?colors:undefined})},nowTime(){return new Date().toLocaleTimeString("ar-EG",{hour:"numeric",minute:"2-digit"})},state,event(name,data,extra){if(memory.slug==="demo")return Promise.resolve({ok:true,reward:moment.config?.reward||null});return core.api("wow-event",{slug:memory.slug,momentId:moment.id,event:name,data:data||null,...(extra||{})})}};
}

function renderReward(config,vars={}){
  const reward=config?.reward;if(!reward||reward.type==="none")return null;
  const box=el("div","wow-reward");
  if(reward.type==="message"){box.appendChild(el("p","wow-hand",tpl(reward.text,vars)));return box}
  if(reward.type==="photo"){
    const figure=el("figure","wow-photo"),img=document.createElement("img");img.src=reward.src;img.alt=reward.caption||"مفاجأة";img.loading="lazy";figure.appendChild(img);
    if(reward.caption)figure.appendChild(el("figcaption","wow-hand",tpl(reward.caption,vars)));box.appendChild(figure);return box;
  }
  if(reward.type==="video"){
    const video=document.createElement("video");video.src=reward.src;video.controls=true;video.playsInline=true;video.preload="metadata";video.className="wow-video";if(reward.poster)video.poster=reward.poster;box.appendChild(video);
    if(reward.caption)box.appendChild(el("p","wow-hand",tpl(reward.caption,vars)));return box;
  }
  return null;
}

// A game is only rendered when it has the buyer's real data. Never show
// placeholder questions to a real recipient (demo memories carry full configs).
export function hasRealData(kind,c,images=[]){
  const n=v=>Array.isArray(v)?v.filter(Boolean).length:0;
  if(kind==="coupons")return n(c.items)>0;
  if(kind==="treasure")return n(c.clues)>0;
  if(kind!=="game")return true;
  switch(c.game){
    case "quiz":return n(c.questions)>0;
    case "finish_sentence":return n(c.questions)>0||(!!c.prompt&&n(c.options)>=2);
    case "order_story":return n(c.events)>=2||n(c.photos)>=2||n(c.images)>=2||(c.autoImages===true&&images.length>=2);
    case "open_when":case "true_false":return n(c.items)>0;
    case "scramble":return String(c.word||"").trim().length>=2;
    case "wheel":return n(c.options)>=2;
    case "balloons":return n(c.lines)>=2;
    case "puzzle":return !!c.image||(c.autoImage===true&&images.length>0);
    case "memory":return n(c.images)>=2||(c.autoImages===true&&images.length>=2);
    case "scratch":return !!c.image||!!String(c.text||"").trim();
    case "guess_place":return !!(c.image||c.photo)&&n(c.options)>=2;
    case "emoji_guess":return !!c.emojis&&n(c.options)>=2;
    case "reunion_countdown":return !!c.meetAt;
    case "story":return !!c.nodes?.start?.text;
    case "love_wrapped":return Number(c.stats?.totalMessages||0)>=10;
    default:return true;
  }
}

export async function mountLegacy({memory,moment,core},kind){
  addGamesCss();document.documentElement.classList.add("wow-on");
  const config=structuredClone(moment.config||{}),media=Array.isArray(memory.media)?memory.media:[];
  const uploadedImages=media.filter(x=>x?.kind==="image"&&x?.url);
  // v38: imageRef = index among the customer's uploaded photos (order wizard).
  const ref=v=>{const n=Number(v);return v!==null&&v!==""&&Number.isInteger(n)&&uploadedImages[n]?.url?uploadedImages[n].url:""};
  if(config.imageRef!==undefined&&ref(config.imageRef)){config.image=ref(config.imageRef);delete config.imageIndex}
  for(const list of [config.events,config.items])if(Array.isArray(list))for(const it of list)if(it&&it.imageRef!==undefined)it.image=ref(it.imageRef);
  if(!hasRealData(kind,config,uploadedImages))return;
  if(config.autoImage===true&&uploadedImages[0]?.url)config.image=uploadedImages[0].url;
  if(config.autoImages===true&&uploadedImages.length)config.images=uploadedImages.slice(0,8).map(x=>x.url);
  if(Number.isInteger(Number(config.imageIndex))&&media[Number(config.imageIndex)]?.url)config.image=media[Number(config.imageIndex)].url;
  if(Array.isArray(config.imageIndexes)){const selected=config.imageIndexes.map(Number).map(i=>media[i]?.url).filter(Boolean);if(selected.length)config.images=selected}
  if(config.reward&&Number.isInteger(Number(config.reward.mediaIndex))&&media[Number(config.reward.mediaIndex)]?.url)config.reward.src=media[Number(config.reward.mediaIndex)].url;
  const root=core.makeMoment(kind,config);root.classList.add("wow-sec",`wow-m-${kind}`);
  const envelope=el("button","wow-envelope");envelope.type="button";envelope.innerHTML=`<span>✦</span><b>${core.escapeHtml(config.storyTitle||config.title||"فيه ظرف مستنيك")}</b><small>اضغط عشان تفتح</small>`;const inside=el("div","wow-envelope-inside hidden");root.append(envelope,inside);envelope.onclick=()=>{envelope.classList.add("hidden");inside.classList.remove("hidden");core.haptic(20);inside.scrollIntoView({behavior:core.reducedMotion()?"auto":"smooth",block:"center"})};
  if(config.title)inside.appendChild(el("h2","wow-h2",config.title));if(config.sub)inside.appendChild(el("p","wow-sub",config.sub));
  const ctx=context(memory,moment,core,root),factory=await loadFactory(kind==="game"?`game-${config.game}`:kind);
  if(kind!=="game"){factory(ctx,inside,config);core.observe(root);return}
  const stage=el("div","wow-game"),rewardWrap=el("div","wow-reward-wrap hidden"),skip=el("button","wow-skip hidden",config.skipLabel||receiverCopy(memory,"skip"));skip.type="button";
  if(config.rewardLocked||config.reward)inside.appendChild(el("div","wow-lockline",`🔒 ${config.lockLabel||receiverCopy(memory,"lockedReward")}`));
  inside.append(stage,skip,rewardWrap);ctx.event("game_start",null).catch(()=>{});
  const saved=ctx.state.get(),started=Date.now();let won=false,fails=0,skipTimer=0;
  const reveal=(vars={},again=false,rewardData=null)=>{root.querySelector(".wow-lockline")?.classList.add("hidden");rewardWrap.replaceChildren();if(again)rewardWrap.appendChild(el("div","wow-done",receiverCopy(memory,"wonBefore")));if(config.winText)rewardWrap.appendChild(el("div","wow-win",tpl(config.winText,vars)));const reward=renderReward({...config,reward:rewardData||config.reward},vars);if(reward)rewardWrap.appendChild(reward);const share=el("button","wow-share-card","نزّل كارت الفوز");share.type="button";share.onclick=()=>{shareCard(config.game,vars);ctx.event("share",{game:config.game}).catch(()=>{})};rewardWrap.appendChild(share);rewardWrap.classList.remove("hidden")};
  ctx.win=async vars=>{if(won)return;won=true;clearTimeout(skipTimer);skip.classList.add("hidden");const out={seconds:core.arDigits(Math.round((Date.now()-started)/1000)),...(vars||{})};core.haptic([40,40,120]);core.confetti({count:140});try{const result=await ctx.event("win",out);ctx.state.set({won:true,vars:out,at:Date.now()});setTimeout(()=>{if(config.hideGameOnWin)stage.classList.add("hidden");reveal(out,false,result.reward)},core.reducedMotion()?0:450)}catch{won=false;core.toast("تعذر حفظ الفوز، جرّب تاني")}};
  ctx.fail=()=>{fails++;ctx.event("game_fail",{fails}).catch(()=>{});if(config.skippable!==false&&fails>=Number(config.skipAfterFails||2))skip.classList.remove("hidden")};
  skip.onclick=async()=>{if(won)return;won=true;clearTimeout(skipTimer);try{const result=await ctx.event("skip",null);stage.classList.add("hidden");skip.classList.add("hidden");ctx.state.set({won:true,skipped:true,vars:{},at:Date.now()});reveal({},false,result.reward)}catch{won=false;core.toast("لسه بدري على التخطي")}};
  if(saved?.won&&config.playOnce!==false){won=true;stage.classList.add("hidden");ctx.event("status",null).then(x=>reveal(saved.vars||{},true,x.reward)).catch(()=>reveal(saved.vars||{},true));core.observe(root);return}
  const after=Math.max(0,Math.min(120,Number(config.skipAfterSec??30)));if(after&&config.skippable!==false)skipTimer=setTimeout(()=>{if(!won)skip.classList.remove("hidden")},after*1000);
  factory(ctx,stage,config);core.observe(root);
}
