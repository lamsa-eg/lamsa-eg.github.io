const __wowCss=document.createElement("link");__wowCss.rel="stylesheet";__wowCss.href="/assets/css/wow.css";__wowCss.dataset.wowTrackCss="1";document.head.appendChild(__wowCss);
import{apiPost as functionPost}from"../lib/api.js";
import{toast,escapeHtml}from"../common-cf-v4.js";

const result=document.getElementById("result");let mounted=false,lastKey="";
function keyBytes(base64){const padding="=".repeat((4-base64.length%4)%4),s=(base64+padding).replace(/-/g,"+").replace(/_/g,"/"),raw=atob(s);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
async function reg(){return await navigator.serviceWorker.register("/sw-v18.js",{scope:"/"})}
function creds(){return{orderNumber:(document.getElementById("order")?.value||sessionStorage.getItem("lamsa_track_order")||"").trim(),trackingToken:(document.getElementById("token")?.value||sessionStorage.getItem("lamsa_track_token")||"").trim()}}

async function load(){
  const c=creds();if(!c.orderNumber||!c.trackingToken)return;
  const key=c.orderNumber+"|"+c.trackingToken;if(key===lastKey&&mounted)return;lastKey=key;
  let cfg=null,replies=null,timeline=null;try{[cfg,replies,timeline]=await Promise.all([functionPost("wow-sender-subscribe",{action:"config",...c}),functionPost("wow-track-replies",c),functionPost("wow-sender-timeline",c)])}catch(e){console.warn("WOW track",e);return}
  let sec=document.getElementById("wowTrack");if(!sec){sec=document.createElement("section");sec.id="wowTrack";sec.className="card result wow-track-box";result.insertAdjacentElement("afterend",sec)}
  mounted=true;const rows=replies?.replies||[],events=timeline?.timeline||[],labels={game_start:"بدأ/بدأت اللعبة",game_fail:"محاولة جديدة",win:"حلّ/حلّت اللعبة",skip:"فتح/فتحت المفاجأة بالتخطي",hunt_step:"لقى/لقت ستيكر",hunt_done:"خلص/خلصت صيد الكنز",redeem:"استخدم/استخدمت كوبون",promise:"اختار/اختارت وعد",letter_open:"فتح/فتحت رسالة",share:"نزّل/نزّلت كارت الفوز",reply:"بعت/بعتت رد"};
  sec.innerHTML=`<span class="kicker">LAMSA WOW ✦</span><h2 style="font:27px Georgia;margin:8px 0">الردود واللحظات المباشرة</h2>
    ${cfg?.genderReveal?`<div class="wow-track-gender"><b>كشف نوع المولود المتزامن</b><p>افتح رابط الذكرى على كل الأجهزة الأول، وبعدها ابدأ العد التنازلي. النتيجة لن تُرسل لأي جهاز قبل انتهاء العد.</p><button id="wowGenderStart" class="romantic-btn light" type="button">ابدأ الكشف بعد ١٢ ثانية</button><small id="wowGenderState">في انتظارك لبدء اللحظة.</small></div>`:""}
    ${cfg?.enabled?`<div class="wow-track-notify"><p>تحب تعرف كل ما تحصل لحظة جديدة؟</p><button id="wowPush" class="romantic-btn light" type="button">فعّل إشعارات الحكاية</button><small id="wowPushState"></small></div>`:""}
    <div class="wow-track-timeline"><h3>خط الحكاية</h3>${events.length?events.map(e=>`<article class="wow-track-event"><i></i><div><b>${escapeHtml(labels[e.kind]||e.title)}</b><p>${escapeHtml(e.kind==="win"&&e.detail?.seconds?`في ${e.detail.seconds} ثانية`:e.kind==="promise"?String(e.detail?.result||""):e.title||"")}</p><small>${new Date(e.createdAt).toLocaleString("ar-EG")}</small></div></article>`).join(""):'<p class="muted small">أول ما الذكرى تتفتح، اللحظات هتظهر هنا بالترتيب.</p>'}</div>
    <div class="wow-track-replies"><h3>ردود الهدية</h3>${rows.length?rows.map(reply=>reply.kind==="text"?`<article class="wow-track-reply"><b>رد مكتوب</b><p>${escapeHtml(reply.text)}</p><small>${new Date(reply.createdAt).toLocaleString("ar-EG")}</small></article>`:reply.kind==="voice"?`<article class="wow-track-reply"><b>رد صوتي</b><audio controls preload="none" src="${escapeHtml(reply.url)}"></audio><small>${new Date(reply.createdAt).toLocaleString("ar-EG")}</small></article>`:`<article class="wow-track-reply"><b>صورة من المراية</b><img loading="lazy" src="${escapeHtml(reply.url)}" alt="رد بصورة"><small>${new Date(reply.createdAt).toLocaleString("ar-EG")}</small></article>`).join(""):'<p class="muted small">لما يوصل رد من الهدية هيظهر هنا.</p>'}</div>`;
  if(cfg?.enabled)setupPush(cfg,c);if(cfg?.genderReveal)setupGender(c);
}

function setupGender(c){
  const btn=document.getElementById("wowGenderStart"),state=document.getElementById("wowGenderState");if(!btn)return;
  btn.onclick=async()=>{btn.disabled=true;state.textContent="جاري تجهيز كل الأجهزة…";try{const d=await functionPost("wow-gender-reveal",{action:"start",...c});const at=d.revealAt?new Date(d.revealAt):null;state.textContent=d.state==="revealed"?"تمت لحظة الكشف بالفعل ♡":at?`بدأ العد — الكشف ${at.toLocaleTimeString("ar-EG")}`:"بدأت اللحظة";btn.textContent="تم بدء الكشف";toast("بدأ العد التنازلي على كل الأجهزة ♡")}catch(e){state.textContent=e.message||"تعذر بدء الكشف";btn.disabled=false}}
}

async function setupPush(cfg,c){
  const btn=document.getElementById("wowPush"),state=document.getElementById("wowPushState");if(!btn)return;
  if(!("Notification"in window)||!("PushManager"in window)){btn.disabled=true;state.textContent="الجهاز ده مش بيدعم Web Push";return}
  try{
    const registration=await reg(),existing=await registration.pushManager.getSubscription();if(existing){btn.textContent="إيقاف إشعار الفتح";btn.dataset.active="1";state.textContent="الإشعار مفعّل على الجهاز ده"}
    btn.onclick=async()=>{try{btn.disabled=true;const registration=await reg();let sub=await registration.pushManager.getSubscription();if(btn.dataset.active==="1"){if(sub){await functionPost("wow-sender-subscribe",{action:"unsubscribe",...c,subscription:sub.toJSON()});await sub.unsubscribe()}btn.dataset.active="0";btn.textContent="فعّل إشعار الفتح";state.textContent="تم إيقاف الإشعار";return}let perm=Notification.permission;if(perm==="default")perm=await Notification.requestPermission();if(perm!=="granted")throw new Error("اسمح بالإشعارات من إعدادات الموقع");if(!cfg.vapidPublicKey)throw new Error("إشعارات LAMSA لسه محتاجة إعداد");if(!sub)sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(cfg.vapidPublicKey)});await functionPost("wow-sender-subscribe",{action:"subscribe",...c,subscription:sub.toJSON()});btn.dataset.active="1";btn.textContent="إيقاف إشعار الفتح";state.textContent="هنبلغك أول ما الهدية تتفتح ♡";toast("تم تفعيل إشعار الفتح")}catch(e){toast(e.message)}finally{btn.disabled=false}}
  }catch(e){console.warn(e)}
}

const mo=new MutationObserver(()=>{if(result&&!result.classList.contains("hidden"))load()});if(result)mo.observe(result,{attributes:true,childList:true,subtree:true});addEventListener("pageshow",()=>setTimeout(load,500));
