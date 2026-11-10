// Pure, dependency-free sanitizer for buyer-selected games (v38).
// Shared by order-wow-selection and unit-tested in tests/unit (Node).
export function clean(v:unknown,max=200){return String(v??"").trim().slice(0,max)}
export const GAME_KEYS=new Set(["setup","quiz","puzzle","hearts","memory","balloons","story","wheel","treasure","coupons","order_story","guess_place","scratch","scramble","finish_sentence","true_false","emoji_guess","constellation","open_when","reunion_countdown","love_wrapped","remote_touch"]);
const INTERACTIVE=new Set(["quiz","puzzle","hearts","memory","balloons","story","wheel"]);
const ANCHORS=new Set(["after_message","after_gallery","before_end"]);

function reward(raw:any){const r=raw&&typeof raw==="object"?raw:{};return{type:["none","message"].includes(clean(r.type,12))?clean(r.type,12):"none",text:clean(r.text,800)}}
function base(raw:any){const c=raw&&typeof raw==="object"?raw:{};return{anchor:ANCHORS.has(clean(c.anchor,30))?clean(c.anchor,30):"after_gallery",title:clean(c.title,140),sub:clean(c.sub,320)}}
function gameConfig(key:string,raw:any){
  const c=raw&&typeof raw==="object"?raw:{},result:any={...base(c),game:key,winText:clean(c.winText,300),skippable:c.skippable!==false,playOnce:c.playOnce!==false,hideGameOnWin:c.hideGameOnWin===true,reward:reward(c.reward)};
  if(key==="quiz"){result.perfect=clean(c.perfect,240);result.good=clean(c.good,240);result.bad=clean(c.bad,240);result.questions=(Array.isArray(c.questions)?c.questions:[]).slice(0,5).map((q:any)=>{const options=(Array.isArray(q?.options)?q.options:[]).slice(0,3).map((x:any)=>clean(x,160)).filter(Boolean),answer=Math.max(0,Math.min(options.length-1,Number(q?.answer||0)));const given=Array.isArray(q?.reactions)?q.reactions:[];return{q:clean(q?.q,300),options,answer,reactions:options.map((_:string,n:number)=>clean(given[n],220)||(n===answer?"صح ♡":"لأ 😅"))}}).filter((q:any)=>q.q&&q.options.length===3);if(!result.questions.length)return null}
  if(key==="puzzle"){result.autoImage=c.autoImage===true;const n=Number(c.imageIndex);if(Number.isInteger(n)&&n>=0&&n<100)result.imageIndex=n;const r=imgRef(c.imageRef);if(r!==null)result.imageRef=r;result.size=Math.max(2,Math.min(4,Number(c.size||3)))}
  if(key==="hearts"){result.target=15;result.seconds=25}
  if(key==="memory"){result.autoImages=c.autoImages===true;result.imageIndexes=(Array.isArray(c.imageIndexes)?c.imageIndexes:[]).slice(0,8).map(Number).filter((x:any)=>Number.isInteger(x)&&x>=0&&x<100);if(!result.autoImages&&result.imageIndexes.length<2)return null}
  if(key==="balloons"){result.lines=(Array.isArray(c.lines)?c.lines:[]).slice(0,12).map((x:any)=>clean(x,240)).filter(Boolean);if(result.lines.length<2)return null}
  if(key==="wheel"){result.options=(Array.isArray(c.options)?c.options:[]).slice(0,12).map((x:any)=>clean(x,120)).filter(Boolean);if(result.options.length<2)return null}
  if(key==="story"){
    result.start="start";result.nodes={};
    for(const [nodeKey,node] of Object.entries(c.nodes&&typeof c.nodes==="object"?c.nodes:{}).slice(0,3)){const id=clean(nodeKey,40);if(!/^[a-z0-9_-]+$/i.test(id))continue;const n:any=node||{};result.nodes[id]={text:clean(n.text,600),title:clean(n.title,120),end:n.end===true,choices:(Array.isArray(n.choices)?n.choices:[]).slice(0,2).map((x:any)=>({label:clean(x?.label,180),next:clean(x?.next,40)})).filter((x:any)=>x.label&&/^[a-z0-9_-]+$/i.test(x.next))}}
    if(!result.nodes.start)return null;
  }
  return result;
}
function imgRef(v:any){if(v===null||v===undefined||v==="")return null;const n=Number(v);return Number.isInteger(n)&&n>=0&&n<30?n:null}
const arr=(v:any,max:number)=>(Array.isArray(v)?v:[]).slice(0,max);
// v38: explicit schemas for every generic game. Unknown fields are dropped.
const GENERIC:Record<string,(c:any)=>any>={
  order_story:c=>{const events=arr(c.events,6).map((e:any)=>({title:clean(e?.title,80),when:clean(e?.when,40),imageRef:imgRef(e?.imageRef)})).filter((e:any)=>e.title);if(events.length>=2)return{events,correctOrder:events.map((_:any,i:number)=>i)};const photos=arr(c.imageIndexes,6).map(Number).filter((x:number)=>Number.isInteger(x)&&x>=0&&x<100);return c.autoImages===true||photos.length>=2?{autoImages:c.autoImages===true,imageIndexes:photos}:null},
  open_when:c=>{const items=arr(c.items,6).map((x:any)=>({title:clean(x?.title,60),text:clean(x?.text,600),imageRef:imgRef(x?.imageRef),once:x?.once===true})).filter((x:any)=>x.title&&x.text);return items.length?{items}:null},
  true_false:c=>{const items=arr(c.items,5).map((x:any)=>({text:clean(x?.text,160),answer:x?.answer===true,reaction:clean(x?.reaction,120)})).filter((x:any)=>x.text);return items.length?{items}:null},
  finish_sentence:c=>{const questions=arr(c.questions,5).map((q:any)=>{const options=arr(q?.options,3).map((x:any)=>clean(x,120)).filter(Boolean);return{q:clean(q?.q,300),options,answer:Math.max(0,Math.min(options.length-1,Number(q?.answer||0))),message:clean(q?.message,200)}}).filter((q:any)=>q.q&&q.options.length>=2);if(questions.length)return{questions,prompt:questions[0].q,options:questions[0].options,answer:questions[0].answer};const options=arr(c.options,3).map((x:any)=>clean(x,160)).filter(Boolean);return clean(c.prompt,300)&&options.length>=2?{prompt:clean(c.prompt,300),options,answer:Math.max(0,Math.min(options.length-1,Number(c.answer||0)))}:null},
  scramble:c=>{const word=clean(c.word,14).replace(/\s+/g,"");return word.length>=2?{word,hint:clean(c.hint,100)}:null},
  scratch:c=>{const text=clean(c.text,160),r=imgRef(c.imageRef);return text||r!==null?{text,imageRef:r}:null},
  reunion_countdown:c=>{const meetAt=clean(c.meetAt,30);return meetAt?{cityA:clean(c.cityA,40),cityB:clean(c.cityB,40),meetAt,message:clean(c.message,200)}:null},
  guess_place:c=>{const options=arr(c.options,3).map((x:any)=>clean(x,80)).filter(Boolean),r=imgRef(c.imageRef);return options.length>=2?{options,answer:Math.max(0,Math.min(options.length-1,Number(c.answer||0))),story:clean(c.story,300),imageRef:r,imageIndex:r??undefined}:null},
  emoji_guess:c=>{const options=arr(c.options,3).map((x:any)=>clean(x,80)).filter(Boolean);return clean(c.emojis,40)&&options.length>=2?{emojis:clean(c.emojis,40),options,answer:Math.max(0,Math.min(options.length-1,Number(c.answer||0)))}:null},
  constellation:c=>({caption:clean(c.caption,200)}),
  hearts:()=>({target:15,seconds:25})
};
export function sanitize(item:any,index:number){
  const key=clean(item?.game,20);if(!GAME_KEYS.has(key))return null;const c=item?.config&&typeof item.config==="object"?item.config:{};
  if(key==="setup")return null;
  if(INTERACTIVE.has(key)){const config=gameConfig(key,c);return config?{type:"game",config,sort_order:200+index*10,enabled:true}:null}
  if(key==="treasure"){const config={...base(c),finalTitle:clean(c.finalTitle,160),finalText:clean(c.finalText,600),clues:(Array.isArray(c.clues)?c.clues:[]).slice(0,12).map((x:any)=>({text:clean(x?.text,400),hint:clean(x?.hint,300)})).filter((x:any)=>x.text)};return config.clues.length?{type:"treasure",config,sort_order:200+index*10,enabled:true}:null}
  if(key==="coupons"){const config={...base(c),items:(Array.isArray(c.items)?c.items:[]).slice(0,12).map((x:any)=>({title:clean(x?.title,140),subtitle:clean(x?.subtitle,240)})).filter((x:any)=>x.title)};return config.items.length?{type:"coupons",config,sort_order:200+index*10,enabled:true}:null}
  if(key==="love_wrapped"){const s=c.stats&&typeof c.stats==="object"?c.stats:{},config={...base(c),game:key,skippable:true,playOnce:true,stats:{totalMessages:Math.max(0,Math.min(2000000,Number(s.totalMessages||0))),participants:(Array.isArray(s.participants)?s.participants:[]).slice(0,2).map((x:any)=>({label:clean(x?.label,30),count:Math.max(0,Number(x?.count||0))})),startsMore:s.startsMore?{label:clean(s.startsMore.label,30),days:Math.max(0,Number(s.startsMore.days||0))}:null,longestDay:s.longestDay?{date:clean(s.longestDay.date,20),count:Math.max(0,Number(s.longestDay.count||0))}:null,topWords:(Array.isArray(s.topWords)?s.topWords:[]).slice(0,5).map((x:any)=>({word:clean(x?.word,30),count:Math.max(0,Number(x?.count||0))})),topEmoji:(Array.isArray(s.topEmoji)?s.topEmoji:[]).slice(0,5).map((x:any)=>({emoji:clean(x?.emoji,8),count:Math.max(0,Number(x?.count||0))}))},reward:{type:"message",text:clean(c.reward?.text,800)}};return config.stats.totalMessages>=10?{type:"game",config,sort_order:200+index*10,enabled:true}:null}
  if(key==="remote_touch"){const config={...base(c),game:key,skippable:true,playOnce:true,reward:{type:"message",text:clean(c.reward?.text,800)}};return{type:"game",config,sort_order:200+index*10,enabled:true}}
  const extra=GENERIC[key];if(!extra)return null;const fields=extra(c);if(!fields)return null;
  const config={...base(c),...fields,game:key,lamsaGame:clean(c.lamsaGame,40),winText:clean(c.winText,300),skippable:c.skippable!==false,playOnce:c.playOnce!==false,reward:reward(c.reward)};
  return{type:"game",config,sort_order:200+index*10,enabled:true};
}

