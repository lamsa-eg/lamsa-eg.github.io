import{qs,toast,escapeHtml}from"../common-cf-v4.js";
import{db,requireAdmin,functionPost}from"../client-cf-v4.js";

const memoryId=qs("id");let ctx=null,config=null,media=[];
const META=[
  {key:"quiz",label:"مين فينا؟",type:"game",hint:"أسئلة حقيقية وإجابة صحيحة"},
  {key:"puzzle",label:"البازل",type:"game",hint:"صورة حقيقية من الذكرى"},
  {key:"hearts",label:"اصطياد القلوب",type:"game",hint:"هدف ومكافأة خاصة"},
  {key:"memory",label:"لعبة الذاكرة",type:"game",hint:"صور أصحاب الذكرى"},
  {key:"balloons",label:"فرقعة البلالين",type:"game",hint:"كلمات خاصة داخل البلالين"},
  {key:"story",label:"اختاري الحكاية",type:"game",hint:"اختيارات ونهايات مخصصة"},
  {key:"wheel",label:"عجلة الخروجات",type:"game",hint:"اقتراحاتكم الحقيقية"},
  {key:"treasure",label:"صيد الكنز",type:"treasure",hint:"ألغاز وأماكن حقيقية"},
  {key:"coupons",label:"كوبونات الحب",type:"coupons",hint:"كوبونات متفق عليها"}
];
const DEFAULTS={
  quiz:{game:"quiz",anchor:"after_gallery",title:"مين فينا؟",sub:"اختاري الإجابة الصح وشوفي قد إيه فاكرة التفاصيل.",skippable:false,winText:"النتيجة: {score} من {total}",perfect:"إنتي حافظاني صم ♡",good:"إجابة حلوة… بس لسه في تفاصيل 😌",bad:"محتاجين نقعد نفتكر الحكاية من أولها 😂",reward:{type:"message",text:"كل إجابة بينا ذكرى… والأجمل لسه جاي ♡"},questions:[{q:"مين غالبًا بيبدأ الصلح؟",options:["أنا","إنت","الاتنين"],answer:2,reactions:["ممكن 😌","ممكن برضه","أحلى إجابة ♡"]}]},
  puzzle:{game:"puzzle",anchor:"after_gallery",title:"ركّبي صورتنا",sub:"بدّلي القطع لحد ما الصورة تكمل.",size:3,winText:"برافو! اتحلت في {moves} حركة",reward:{type:"message",text:"كل صورة بينا حكاية كاملة ♡"}},
  hearts:{game:"hearts",anchor:"after_gallery",title:"اصطادي القلوب",sub:"المسي القلوب قبل ما الوقت يخلص.",target:15,seconds:25,winText:"كسبتي وفاضل {left} ثانية!",reward:{type:"message",text:"كل قلب منهم بيقولك: بحبك ♡"}},
  memory:{game:"memory",anchor:"after_gallery",title:"لعبة ذكرياتنا",sub:"لاقي كل صورة وتوأمها.",winText:"ذاكرتك حديد! {moves} محاولة",reward:{type:"message",text:"الذكريات الحلوة عمرها ما بتضيع ♡"}},
  balloons:{game:"balloons",anchor:"after_gallery",title:"فرقعي البلالين",sub:"كل بلونة فيها كلمة من القلب.",lines:["وجودك بيجمّل يومي","ضحكتك بتصلّح كل حاجة","أحلى صدفة في حياتي"],winText:"المفاجأة 🎉",reward:{type:"message",text:"الحكاية لسه فيها مفاجآت كتير ♡"}},
  story:{game:"story",anchor:"after_gallery",title:"اختاري حكايتنا",sub:"اختاري الطريق اللي شبهنا.",skippable:false,start:"start",nodes:{start:{text:"لو عندنا يوم كامل لينا، نبدأه إزاي؟",choices:[{label:"خروجة هادية",next:"choice_a"},{label:"مغامرة جديدة",next:"choice_b"}]},choice_a:{text:"قهوة هادية وكلام من غير ما نحس بالوقت ♡",title:"الخروجة الهادية",end:true,choices:[]},choice_b:{text:"طريق جديد وصور وضحك كتير ♡",title:"المغامرة",end:true,choices:[]}},winText:"وصلتي لنهاية: {ending}",reward:{type:"none"}},
  wheel:{game:"wheel",anchor:"after_gallery",title:"عجلة خروجاتنا",sub:"لفّيها واللي يطلع نتفق عليه.",skippable:false,options:["عشا هادي","سينما","فطار سوا","تمشية"],winText:"اختيارنا: {result}",reward:{type:"none"}},
  treasure:{anchor:"after_gallery",title:"صيد الكنز",sub:"حلّي الألغاز واحدة واحدة.",clues:[{text:"مكان بدأ منه يوم جميل بينا",hint:"افتكري أول خروجة"}],finalTitle:"لقيتي الكنز!",finalText:"المفاجأة مستنياكي هنا ♡"},
  coupons:{anchor:"before_end",title:"كوبونات ليكي",sub:"كل كوبون بيتستخدم مرة واحدة.",items:[{title:"خروجة من اختيارك",subtitle:"المكان والميعاد عليكي"}]}
};

const esc=v=>escapeHtml(v??"");
const lines=v=>String(v||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
function momentKey(m){return m.type==="game"?String(m.config?.game||""):m.type}
function existing(key){return(config?.moments||[]).find(x=>momentKey(x)===key)}
function draft(key){const old=existing(key)?.config||{};return{...structuredClone(DEFAULTS[key]),...structuredClone(old),reward:{...(DEFAULTS[key]?.reward||{}),...(old.reward||{})}}}
function field(label,id,value,type="text",extra=""){return`<label class="field wow-config-field">${esc(label)}<input ${id?`id="${esc(id)}"`:""} type="${esc(type)}" value="${esc(value)}" ${extra}></label>`}
function area(label,id,value,help=""){return`<label class="field wow-config-field full">${esc(label)}<textarea id="${esc(id)}" rows="3">${esc(value)}</textarea>${help?`<small>${esc(help)}</small>`:""}</label>`}
function common(key,c){return`<div class="wow-config-grid">${field("عنوان اللعبة",`${key}-title`,c.title||"")}${field("الجملة التوضيحية",`${key}-sub`,c.sub||"")}<label class="field wow-config-field">مكان ظهورها<select id="${key}-anchor"><option value="after_message" ${c.anchor==="after_message"?"selected":""}>بعد الرسالة</option><option value="after_gallery" ${c.anchor==="after_gallery"?"selected":""}>بعد الصور</option><option value="before_end" ${c.anchor==="before_end"?"selected":""}>قبل نهاية الذكرى</option></select></label></div>`}
function reward(key,c){return area("رسالة المكافأة بعد الفوز",`${key}-reward`,c.reward?.text||"")}
function photoOptions(selected){const opts=media.map(x=>`<option value="${x.index}" ${Number(selected)===x.index?"selected":""}>صورة ${x.imageNo}: ${esc(x.caption||"بدون اسم")}</option>`).join("");return`<option value="">اختر صورة من الذكرى</option>${opts}`}
function photoChecks(selected=[]){const set=new Set((selected||[]).map(Number));return media.map(x=>`<label class="wow-media-choice"><input type="checkbox" data-memory-photo value="${x.index}" ${set.has(x.index)?"checked":""}>${x.url?`<img src="${esc(x.url)}" alt="">`:""}<span>صورة ${x.imageNo}<small>${esc(x.caption||"")}</small></span></label>`).join("")||'<p class="muted small">ارفع صورتين على الأقل في قسم الوسائط أولًا.</p>'}
function quizRows(items=[]){return(items.length?items:[DEFAULTS.quiz.questions[0]]).map((q,i)=>`<div class="wow-question" data-quiz-row><div class="wow-question-head"><b>سؤال ${i+1}</b><button type="button" class="btn ghost" data-remove-question>حذف</button></div>${field("السؤال","",q.q||"","text",'data-q maxlength="300"')}${[0,1,2].map(n=>field(`الاختيار ${n+1}`,"",q.options?.[n]||"","text",`data-opt="${n}" maxlength="160"`)).join("")}<label class="field wow-config-field">الإجابة الصحيحة<select data-answer>${[0,1,2].map(n=>`<option value="${n}" ${Number(q.answer)===n?"selected":""}>الاختيار ${n+1}</option>`).join("")}</select></label></div>`).join("")}
function specialized(key,c){
  if(key==="quiz")return`<div id="quizQuestions">${quizRows(c.questions)}</div><button type="button" class="heart-outline-btn" id="addQuizQuestion">+ إضافة سؤال</button>${field("رسالة الدرجة الكاملة","quiz-perfect",c.perfect||"")}${field("رسالة الدرجة المتوسطة","quiz-good",c.good||"")}${field("رسالة الدرجة الضعيفة","quiz-bad",c.bad||"")}${reward(key,c)}`;
  if(key==="puzzle")return`<label class="field wow-config-field">صورة البازل<select id="puzzle-image">${photoOptions(c.imageIndex??(c.autoImage?media[0]?.index:undefined))}</select></label><label class="field wow-config-field">الصعوبة<select id="puzzle-size"><option value="2" ${Number(c.size)===2?"selected":""}>سهلة ٢×٢</option><option value="3" ${Number(c.size||3)===3?"selected":""}>متوسطة ٣×٣</option><option value="4" ${Number(c.size)===4?"selected":""}>صعبة ٤×٤</option></select></label>${reward(key,c)}`;
  if(key==="hearts")return`<div class="wow-config-grid">${field("عدد القلوب المطلوبة","hearts-target",c.target||15,"number",'min="5" max="60"')}${field("الوقت بالثواني","hearts-seconds",c.seconds||25,"number",'min="10" max="90"')}</div>${reward(key,c)}`;
  if(key==="memory")return`<p class="muted small">اختر من ٢ إلى ٨ صور حقيقية للعبة:</p><div class="wow-media-grid" id="memoryPhotos">${photoChecks(c.imageIndexes?.length?c.imageIndexes:(c.autoImages?media.slice(0,8).map(x=>x.index):[]))}</div>${reward(key,c)}`;
  if(key==="balloons")return`${area("الكلمات داخل البلالين","balloons-lines",(c.lines||[]).join("\n"),"اكتب كل رسالة في سطر منفصل")}${reward(key,c)}`;
  if(key==="story"){const s=c.nodes?.start||{},a=c.nodes?.choice_a||{},b=c.nodes?.choice_b||{};return`${area("بداية الحكاية / السؤال","story-start",s.text||"")}<div class="wow-config-grid">${field("الاختيار الأول","story-a-label",s.choices?.[0]?.label||"")}${field("الاختيار الثاني","story-b-label",s.choices?.[1]?.label||"")}</div>${area("نهاية الاختيار الأول","story-a-end",a.text||"")}${area("نهاية الاختيار الثاني","story-b-end",b.text||"")}`}
  if(key==="wheel")return area("اختيارات عجلة الخروجات","wheel-options",(c.options||[]).join("\n"),"اكتب كل خروجة في سطر منفصل");
  if(key==="treasure")return`${area("ألغاز صيد الكنز","treasure-clues",(c.clues||[]).map(x=>`${x.text}${x.hint?` | ${x.hint}`:""}`).join("\n"),"كل سطر: اللغز | التلميح")}${field("عنوان الوصول للكنز","treasure-final-title",c.finalTitle||"")}${area("رسالة الكنز الأخيرة","treasure-final-text",c.finalText||"")}`;
  return area("كوبونات الحب","coupons-items",(c.items||[]).map(x=>`${x.title}${x.subtitle?` | ${x.subtitle}`:""}`).join("\n"),"كل سطر: اسم الكوبون | التفاصيل");
}
function panel(){
  const host=document.getElementById("wowPhase2Admin")||document.querySelector(".editor .card.panel .editor-section");if(!host)return null;
  const section=document.createElement("section");section.className="wow-admin-games";section.id="wowGamesAdmin";
  section.innerHTML=`<span class="kicker">WOW · GAMES V34</span><h3>ألعاب مخصصة لأصحاب الذكرى</h3><p class="muted small">فعّل اللعبة، ثم افتح إعداداتها واكتب التفاصيل الحقيقية الخاصة بالعميل.</p><div id="wowGameEditors"></div><button class="romantic-btn light" id="wowGamesSave" type="button">حفظ الألعاب المخصصة</button><small id="wowGamesState" class="muted" style="display:block;margin-top:9px"></small>`;
  host.insertAdjacentElement("afterend",section);return section;
}
async function loadMedia(){
  const s=db();if(!s)return;const{data}=await s.from("memory_media").select("kind,storage_bucket,storage_path,caption,sort_order,created_at").eq("memory_id",memoryId).order("sort_order").order("created_at");
  const rows=data||[];let imageNo=0;media=[];
  for(let index=0;index<rows.length;index++){const x=rows[index];if(!["image","cover","logo","background"].includes(x.kind))continue;imageNo++;let url="";try{const{data:signed}=await s.storage.from(x.storage_bucket||"memory-media").createSignedUrl(x.storage_path,900);url=signed?.signedUrl||""}catch{}media.push({index,imageNo,caption:x.caption||x.storage_path,url})}
}
function bindQuiz(){
  const box=document.getElementById("quizQuestions");if(!box)return;
  box.querySelectorAll("[data-remove-question]").forEach(b=>b.onclick=()=>{if(box.querySelectorAll("[data-quiz-row]").length<=1){toast("لازم سؤال واحد على الأقل");return}b.closest("[data-quiz-row]").remove();renumberQuiz()});
  const add=document.getElementById("addQuizQuestion");if(add)add.onclick=()=>{box.insertAdjacentHTML("beforeend",quizRows([{q:"",options:["","",""],answer:0,reactions:[]} ]));bindQuiz();renumberQuiz()};
}
function renumberQuiz(){document.querySelectorAll("[data-quiz-row]").forEach((r,i)=>{const b=r.querySelector(".wow-question-head b");if(b)b.textContent=`سؤال ${i+1}`})}
function render(){
  const box=document.getElementById("wowGameEditors");
  box.innerHTML=META.map(g=>{const c=draft(g.key),on=!!existing(g.key)&&existing(g.key).enabled!==false;return`<article class="wow-game-card ${on?"enabled":""}" data-game-card="${g.key}"><div class="wow-game-card-head"><label><input type="checkbox" data-wow-game="${g.key}" ${on?"checked":""}><span><b>${esc(g.label)}</b><small>${esc(g.hint)}</small></span></label><button type="button" class="btn ghost" data-toggle-game="${g.key}">الإعدادات</button></div><div class="wow-game-config" ${on?"":"hidden"}>${common(g.key,c)}${specialized(g.key,c)}</div></article>`}).join("");
  document.querySelectorAll("[data-wow-game]").forEach(el=>el.onchange=()=>{const card=el.closest("[data-game-card]");card.classList.toggle("enabled",el.checked);card.querySelector(".wow-game-config").hidden=!el.checked;fillState()});
  document.querySelectorAll("[data-toggle-game]").forEach(b=>b.onclick=()=>{const card=b.closest("[data-game-card]"),cfg=card.querySelector(".wow-game-config"),check=card.querySelector("[data-wow-game]");if(!check.checked){check.checked=true;card.classList.add("enabled");fillState()}cfg.hidden=!cfg.hidden});
  const hunt=existing("treasure"),huntBox=document.querySelector('[data-game-card="treasure"] .wow-game-config');if(hunt?.id&&huntBox){huntBox.insertAdjacentHTML("beforeend",'<button type="button" class="heart-outline-btn" id="generateHuntLinks">تجهيز روابط الستيكرات الآمنة</button><div id="huntLinks" class="muted small"></div>');document.getElementById("generateHuntLinks").onclick=async()=>{try{const d=await functionPost("wow-hunt-step",{action:"sign",memoryId,momentId:hunt.id,count:Math.min(12,hunt.config?.clues?.length||3)},ctx.session.access_token);document.getElementById("huntLinks").innerHTML=(d.links||[]).map((x,i)=>`<p>ستيكر ${i+1}: <code style="direction:ltr;word-break:break-all">${escapeHtml(location.origin+x.url)}</code></p>`).join("")}catch(e){toast(e.message)}}}
  bindQuiz();fillState();
}
function commonConfig(key,c){return{...c,title:document.getElementById(`${key}-title`)?.value.trim()||c.title||"",sub:document.getElementById(`${key}-sub`)?.value.trim()||"",anchor:document.getElementById(`${key}-anchor`)?.value||"after_gallery"}}
function rewardConfig(key,c){const text=document.getElementById(`${key}-reward`)?.value.trim()||"";return{...(c.reward||{}),type:text?"message":"none",text}}
function collectQuiz(){return[...document.querySelectorAll("[data-quiz-row]")].map((r,i)=>{const q=r.querySelector("[data-q]").value.trim(),options=[...r.querySelectorAll("[data-opt]")].map(x=>x.value.trim());if(!q||options.some(x=>!x))throw new Error(`أكمل السؤال ${i+1} وكل اختياراته`);const answer=Number(r.querySelector("[data-answer]").value);return{q,options,answer,reactions:options.map((_,n)=>n===answer?"صح ♡":"لأ 😅")}})}
function collect(key){
  const c=commonConfig(key,draft(key));
  if(key==="quiz"){c.questions=collectQuiz();c.perfect=document.getElementById("quiz-perfect").value.trim();c.good=document.getElementById("quiz-good").value.trim();c.bad=document.getElementById("quiz-bad").value.trim();c.reward=rewardConfig(key,c)}
  else if(key==="puzzle"){const raw=document.getElementById("puzzle-image").value,n=Number(raw);if(raw===""||!Number.isInteger(n)||!media.some(x=>x.index===n))throw new Error("اختر صورة حقيقية للبازل");c.imageIndex=n;delete c.image;c.size=Number(document.getElementById("puzzle-size").value);c.reward=rewardConfig(key,c)}
  else if(key==="hearts"){c.target=Number(document.getElementById("hearts-target").value);c.seconds=Number(document.getElementById("hearts-seconds").value);c.reward=rewardConfig(key,c)}
  else if(key==="memory"){c.imageIndexes=[...document.querySelectorAll("[data-memory-photo]:checked")].map(x=>Number(x.value));if(c.imageIndexes.length<2)throw new Error("اختر صورتين على الأقل للعبة الذاكرة");if(c.imageIndexes.length>8)throw new Error("اختر ٨ صور بحد أقصى للعبة الذاكرة");delete c.images;c.reward=rewardConfig(key,c)}
  else if(key==="balloons"){c.lines=lines(document.getElementById("balloons-lines").value);if(c.lines.length<2)throw new Error("اكتب رسالتين على الأقل داخل البلالين");c.reward=rewardConfig(key,c)}
  else if(key==="story"){const prompt=document.getElementById("story-start").value.trim(),al=document.getElementById("story-a-label").value.trim(),bl=document.getElementById("story-b-label").value.trim(),ae=document.getElementById("story-a-end").value.trim(),be=document.getElementById("story-b-end").value.trim();if(!prompt||!al||!bl||!ae||!be)throw new Error("أكمل بداية الحكاية والاختيارات والنهايات");c.start="start";c.nodes={start:{text:prompt,choices:[{label:al,next:"choice_a"},{label:bl,next:"choice_b"}]},choice_a:{text:ae,title:al,end:true,choices:[]},choice_b:{text:be,title:bl,end:true,choices:[]}}}
  else if(key==="wheel"){c.options=lines(document.getElementById("wheel-options").value);if(c.options.length<2)throw new Error("اكتب اختيارين على الأقل في عجلة الخروجات")}
  else if(key==="treasure"){c.clues=lines(document.getElementById("treasure-clues").value).map(x=>{const[t,...h]=x.split("|");return{text:t.trim(),hint:h.join("|").trim()}}).filter(x=>x.text);if(!c.clues.length)throw new Error("اكتب لغزًا واحدًا على الأقل لصيد الكنز");c.finalTitle=document.getElementById("treasure-final-title").value.trim();c.finalText=document.getElementById("treasure-final-text").value.trim()}
  else{c.items=lines(document.getElementById("coupons-items").value).map(x=>{const[t,...s]=x.split("|");return{title:t.trim(),subtitle:s.join("|").trim()}}).filter(x=>x.title);if(!c.items.length)throw new Error("اكتب كوبونًا واحدًا على الأقل")}
  return c;
}
function fillState(){const active=META.filter(g=>document.querySelector(`[data-wow-game="${g.key}"]`)?.checked);document.getElementById("wowGamesState").textContent=`مفعّل الآن: ${active.length?active.map(x=>x.label).join("، "):"لا توجد ألعاب"}`}
async function save(){
  const btn=document.getElementById("wowGamesSave");btn.disabled=true;
  try{
    const chosen=META.filter(game=>document.querySelector(`[data-wow-game="${game.key}"]`)?.checked);if(chosen.length>3)throw new Error("صفحة الذكرى تسمح بحد أقصى ٣ ألعاب");
    const managed=new Set(META.map(g=>g.key)),moments=[...(config?.moments||[])].filter(m=>!managed.has(momentKey(m)));let order=Math.max(200,...moments.map(x=>Number(x.sortOrder||0)+10));
    for(const game of META){if(!document.querySelector(`[data-wow-game="${game.key}"]`)?.checked)continue;moments.push({type:game.type,enabled:true,sortOrder:order,config:collect(game.key)});order+=10}
    const gates=config?.wow?.gates||{},gateOn=!!(gates.wax_seal?.enabled||gates.locked?.enabled||gates.secret_question?.enabled);
    config=await functionPost("wow-admin-config",{action:"save",memoryId,enabled:moments.length>0||gateOn,pack:"wow_love_games",theme:config?.wow?.theme,gates,moments},ctx.session.access_token);
    render();toast("تم حفظ الألعاب الحقيقية لهذه الذكرى");document.getElementById("frame").src=`../memory.html?preview=${encodeURIComponent(memoryId)}&t=${Date.now()}`;
  }catch(e){toast(e.message||"تعذر حفظ ألعاب WOW")}finally{btn.disabled=false}
}
export async function mountGamesAdmin(){if(!memoryId)return;const root=panel();if(!root)return;ctx=await requireAdmin();if(!ctx){root.remove();return}try{await loadMedia();config=await functionPost("wow-admin-config",{action:"get",memoryId},ctx.session.access_token);render();document.getElementById("wowGamesSave").onclick=save}catch(e){root.querySelector("#wowGamesState").textContent=e.message||"تعذر تحميل الألعاب"}}
mountGamesAdmin();
