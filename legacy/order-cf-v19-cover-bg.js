import { PACKAGE_INFO, applyPackageRows, packageRule, fileKind, safeFilename, toast, configured, httpUrl, money } from "./common-cf-v4.js";
import { apiPost as functionPost, loadPublicConfig } from "./public-client-v18.js";
import { optimizeImageFile } from "./image-optimize-v26.js";
import { mountOrderGames, collectOrderGames } from "./wow/order-games-v34.js";

if(!document.querySelector('link[data-order-v37]')){const style=document.createElement("link");style.rel="stylesheet";style.href="/assets/css/order-v37.css";style.dataset.orderV37="1";document.head.appendChild(style)}
document.body.dataset.lamsaRelease="CF-V37-PREMIUM-JOURNEY";

const requestedPackage=new URLSearchParams(location.search).get("package");
let selected=Object.hasOwn(PACKAGE_INFO,requestedPackage)?requestedPackage:"memory";
let selectedTheme="black_rose";
let requestId=sessionStorage.getItem("lamsa_order_request_id")||crypto.randomUUID();
sessionStorage.setItem("lamsa_order_request_id",requestId);
const shippingZones=new Map();
const themeLabels={black_rose:"أسود × وردي",black_gold:"ذهبي × أسود",birthday_balloons:"عيد ميلاد · بالونات",elegant_cream:"كلاسيك دافئ"};
const form=document.getElementById("orderForm");
const priceEl=document.getElementById("price"),packageLabel=document.getElementById("packageLabel"),packageMediaSummary=document.getElementById("packageMediaSummary");
const themeSummary=document.getElementById("themeSummary"),layoutSummary=document.getElementById("layoutSummary"),shippingSummary=document.getElementById("shippingSummary"),totalSummary=document.getElementById("totalSummary"),shippingZoneEl=document.getElementById("shippingZone");
const filePreview=document.getElementById("filePreview"),submit=document.getElementById("submitOrder"),progress=document.getElementById("progress"),bar=document.getElementById("bar"),progressText=document.getElementById("progressText");
const inputs={image:document.getElementById("images"),video:document.getElementById("video"),audio:document.getElementById("audio"),logo:document.getElementById("cover"),background:document.getElementById("background")};
const cards={image:document.getElementById("uploadImages"),video:document.getElementById("uploadVideo"),audio:document.getElementById("uploadAudio"),logo:document.getElementById("uploadCover"),background:document.getElementById("uploadBackground")};
const hints={image:document.getElementById("imagesHint"),video:document.getElementById("videoHint"),audio:document.getElementById("audioHint"),logo:document.getElementById("coverHint"),background:document.getElementById("backgroundHint")};
const songFields=document.getElementById("songFields"),capabilities=document.getElementById("packageCapabilities");
const orderError=document.getElementById("orderError"),orderErrorText=document.getElementById("orderErrorText");
form.addEventListener("submit",e=>e.preventDefault());
mountOrderGames();

function clearOrderError(){orderError?.classList.remove("show");if(orderErrorText)orderErrorText.textContent="";}
function showOrderError(message,target){if(orderErrorText)orderErrorText.textContent=String(message||"راجع بيانات الطلب وحاول مرة أخرى.");orderError?.classList.add("show");if(target){target.scrollIntoView({behavior:"smooth",block:"center"});target.focus?.({preventScroll:true});}}
function invalidFieldMessage(el){if(!el)return "راجع الخانات المطلوبة ثم حاول مرة أخرى.";if(el.name==="legalConsent")return "لازم توافق على الشروط وسياسة الخصوصية قبل إرسال الطلب.";if(el.name==="shippingZone")return "اختار منطقة الشحن.";const label=el.closest("label")?.childNodes?.[0]?.textContent?.trim();return label?`راجع خانة: ${label}.`:"راجع الخانات المطلوبة ثم حاول مرة أخرى.";}

const MIME={image:new Set(["image/jpeg","image/png","image/webp"]),video:new Set(["video/mp4","video/quicktime"]),audio:new Set(["audio/mpeg","audio/mp4","audio/x-m4a","audio/wav"]),logo:new Set(["image/jpeg","image/png","image/webp"]),background:new Set(["image/jpeg","image/png","image/webp"])};
function mb(bytes){return Math.round(bytes/1024/1024)}
const FILE_KIND=new WeakMap();
function selectedFiles(){const out=[];for(const [kind,input] of Object.entries(inputs)){for(const f of input.files){FILE_KIND.set(f,kind);out.push(f)}}return out}
function kindForFile(file){return FILE_KIND.get(file)||fileKind(file)}
function mainFiles(){return selectedFiles().filter(f=>["image","video","audio"].includes(kindForFile(f)))}
function specialFiles(){const out=[];const cover=inputs.logo.files[0],background=inputs.background.files[0];if(cover)out.push({kind:"logo",file:cover});if(background)out.push({kind:"background",file:background});return out}
function trimFileInput(input,max){if(input.files.length<=max)return false;if(typeof DataTransfer==="undefined"){input.value="";return true}const dt=new DataTransfer();[...input.files].slice(0,max).forEach(f=>dt.items.add(f));input.files=dt.files;return true}
function clearKind(kind){if(inputs[kind].files.length)inputs[kind].value=""}
function setInputFiles(input,files){
  if(typeof DataTransfer==="undefined"){if(!files.length)input.value="";return false}
  const dt=new DataTransfer();for(const f of files)dt.items.add(f);input.files=dt.files;return true
}
async function imageIsReadable(file){
  if(!file||file.size<=0)return false;
  try{
    if("createImageBitmap" in window){const bmp=await createImageBitmap(file);const ok=Number(bmp.width)>0&&Number(bmp.height)>0;bmp.close?.();if(ok)return true}
  }catch{}
  return await new Promise(resolve=>{
    const url=URL.createObjectURL(file),img=new Image();
    const done=v=>{URL.revokeObjectURL(url);resolve(v)};
    img.onload=()=>done(img.naturalWidth>0&&img.naturalHeight>0);img.onerror=()=>done(false);img.src=url;
  });
}
function rejectionSummary(rejected){
  if(!rejected.length)return "";
  const details=rejected.slice(0,2).map(x=>`${x.file.name}: ${x.reason}`).join(" · ");
  return `تم تجاهل ${rejected.length} ملف غير صالح${details?` — ${details}`:""}${rejected.length>2?" …":""}`;
}
async function sanitizeInputSelection(kind,input){
  const rule=packageRule(selected),files=[...input.files],valid=[],rejected=[];
  const maxCoverSize=3*1024*1024,maxBackgroundSize=5*1024*1024;
  let compressed=0;
  for(const original of files){
    let f=original,reason="";
    if(!MIME[kind]?.has(f.type))reason="الصيغة غير مدعومة";
    else if(f.size<=0)reason="الملف فارغ أو تالف";
    else if(kind==="video"&&!rule.allowVideo)reason="الفيديو غير متاح في هذه الباقة";
    else if(kind==="video"&&f.size>rule.maxVideoBytes)reason=`أكبر من ${mb(rule.maxVideoBytes)}MB`;
    else if(kind==="audio"&&!rule.allowAudio)reason="الصوت غير متاح في هذه الباقة";
    else if(kind==="audio"&&f.size>rule.maxAudioBytes)reason=`أكبر من ${mb(rule.maxAudioBytes)}MB`;
    else if(kind==="image"&&valid.length>=rule.maxImages)reason=`تجاوز حد ${rule.maxImages} صور`;

    if(!reason&&["image","logo","background"].includes(kind)){
      const limit=kind==="image"?rule.maxImageBytes:kind==="logo"?maxCoverSize:maxBackgroundSize;
      try{
        const optimized=await optimizeImageFile(f,limit,{maxDimension:kind==="image"?2560:2200});
        f=optimized.file;if(optimized.compressed)compressed++;
      }catch(e){reason=e?.message||`تعذر تجهيز الصورة لأقل من ${mb(limit)}MB`;}
    }
    if(!reason&&["image","logo","background"].includes(kind)&&!(await imageIsReadable(f)))reason="الصورة غير قابلة للقراءة أو تالفة";
    if(reason)rejected.push({file:original,reason});else{FILE_KIND.set(f,kind);valid.push(f)}
  }
  setInputFiles(input,valid);
  return{valid,rejected,compressed};
}
function validateFiles(fs,rule=packageRule(selected),requireImage=true){const grouped={image:[],video:[],audio:[],logo:[],background:[]};for(const f of fs){const kind=kindForFile(f);if(!grouped[kind])throw new Error(`نوع الملف ${f.name} غير مسموح.`);if(!MIME[kind].has(f.type))throw new Error(`صيغة الملف ${f.name} غير مدعومة.`);grouped[kind].push(f)}if(requireImage&&grouped.image.length<1)throw new Error("أضف صورة واحدة على الأقل للهدية.");if(grouped.image.length>rule.maxImages)throw new Error(`باقة ${rule.label} تسمح بحد أقصى ${rule.maxImages} صور.`);if(grouped.video.length&&!rule.allowVideo)throw new Error("الفيديو متاح في Premium فقط.");if(grouped.audio.length&&!rule.allowAudio)throw new Error("الرسالة الصوتية متاحة في Premium فقط.");if(grouped.video.length>1||grouped.audio.length>1||grouped.logo.length>1||grouped.background.length>1)throw new Error("مسموح فيديو واحد وصوت واحد وكوفر واحد وخلفية واحدة فقط.");const maxCoverSize=3*1024*1024,maxBackgroundSize=5*1024*1024;for(const f of grouped.image)if(f.size<=0||f.size>rule.maxImageBytes)throw new Error(`الصورة ${f.name} أكبر من ${mb(rule.maxImageBytes)}MB أو غير صالحة.`);for(const f of grouped.video)if(f.size<=0||f.size>rule.maxVideoBytes)throw new Error(`الفيديو أكبر من ${mb(rule.maxVideoBytes)}MB أو غير صالح.`);for(const f of grouped.audio)if(f.size<=0||f.size>rule.maxAudioBytes)throw new Error(`التسجيل الصوتي أكبر من ${mb(rule.maxAudioBytes)}MB أو غير صالح.`);for(const f of grouped.logo)if(f.size<=0||f.size>maxCoverSize)throw new Error(`صورة الكوفر أكبر من ${mb(maxCoverSize)}MB أو غير صالحة.`);for(const f of grouped.background)if(f.size<=0||f.size>maxBackgroundSize)throw new Error(`صورة الخلفية أكبر من ${mb(maxBackgroundSize)}MB أو غير صالحة.`)}
function renderFiles(){const fs=selectedFiles();const iconMap={image:"◇",video:"▷",audio:"◉",logo:"♥",background:"▧"};filePreview.innerHTML=fs.length?fs.map(f=>`<div class="file-row"><span>${iconMap[kindForFile(f)]||"●"} ${String(f.name).replace(/[&<>"']/g," ")}</span><b>${(f.size/1024/1024).toFixed(1)} MB</b></div>`).join(""):""}
function setCard(kind,enabled,text){cards[kind].classList.toggle("disabled",!enabled);inputs[kind].disabled=!enabled;hints[kind].textContent=text}
function ruleSummary(r){const parts=[`${r.maxImages} صور`];if(r.allowVideo)parts.push("فيديو");if(r.allowAudio)parts.push("رسالة صوتية");if(r.allowSong)parts.push("أغنية");return parts.join(" + ")}
function syncSpecialImages(){setCard("logo",true,"اختياري — الصور الكبيرة تُضغط تلقائيًا حتى 3MB · لو فاضية أول صورة تبقى الكوفر");setCard("background",true,"اختياري — الصور الكبيرة تُضغط تلقائيًا حتى 5MB · لو فاضية أول صورة تبقى الخلفية")}
function selectedZone(){return shippingZones.get(shippingZoneEl.value)||null}
function updatePriceSummary(){const r=packageRule(selected),zone=selectedZone();priceEl.textContent=r.price;themeSummary.textContent=themeLabels[selectedTheme]||themeLabels.black_rose;if(layoutSummary){const v=form.elements.layoutStyle?.value||"carousel";layoutSummary.textContent=({grid:"شبكة ثلاثية",grid2:"شبكة ثنائية",gallery:"معرض رأسي",carousel:"عرض متحرك كالفيديو"}[v]||"عرض متحرك كالفيديو")};if(!zone||zone.fee===null||zone.fee===undefined){shippingSummary.textContent="يُحدد حسب المنطقة";totalSummary.textContent=`${r.price} ج.م + الشحن`}else{shippingSummary.textContent=money(zone.fee);totalSummary.textContent=money(Number(r.price)+Number(zone.fee))}}
function applyPackage(id,{announce=false}={}){selected=Object.hasOwn(PACKAGE_INFO,id)?id:"memory";const r=packageRule(selected);document.querySelectorAll(".pkg").forEach(c=>{const active=c.dataset.id===selected;c.classList.toggle("active",active);c.setAttribute("aria-checked",active?"true":"false");c.tabIndex=0});packageLabel.textContent=r.label;packageMediaSummary.textContent=ruleSummary(r);capabilities.textContent=`باقة ${r.label}: ${ruleSummary(r)}. الحد الأقصى للصورة ${mb(r.maxImageBytes)}MB${r.allowVideo?`، الفيديو ${mb(r.maxVideoBytes)}MB`:""}${r.allowAudio?`، الصوت ${mb(r.maxAudioBytes)}MB`:""}.`;const removed=[];if(!r.allowVideo&&inputs.video.files.length){clearKind("video");removed.push("الفيديو")}if(!r.allowAudio&&inputs.audio.files.length){clearKind("audio");removed.push("التسجيل الصوتي")}if(inputs.image.files.length>r.maxImages){trimFileInput(inputs.image,r.maxImages);removed.push(`الصور الزائدة عن ${r.maxImages}`)}setCard("image",true,`حتى ${r.maxImages} صور — الصور الكبيرة تُضغط تلقائيًا إلى أقل من ${mb(r.maxImageBytes)}MB`);setCard("video",r.allowVideo,r.allowVideo?`فيديو واحد — حتى ${mb(r.maxVideoBytes)}MB`:"متاح في Premium فقط");setCard("audio",r.allowAudio,r.allowAudio?`رسالة واحدة — حتى ${mb(r.maxAudioBytes)}MB`:"متاح في Premium فقط");syncSpecialImages();songFields.classList.toggle("hidden",!r.allowSong);[...songFields.querySelectorAll("input")].forEach(el=>{el.disabled=!r.allowSong;if(!r.allowSong)el.value=""});renderFiles();updatePriceSummary();if(announce&&removed.length)toast(`تم حذف ${removed.join(" و ")} لأنها غير متاحة في باقة ${r.label}.`)}
async function loadCatalog(){
  shippingZoneEl.innerHTML='<option value="">تحميل الأسعار ومناطق الشحن…</option>';
  try{
    const data=await loadPublicConfig();
    applyPackageRows(data.packages||[]);
    for(const c of document.querySelectorAll(".pkg")){
      const r=packageRule(c.dataset.id);
      c.querySelector(".pkg-name").textContent=r.label;
      c.querySelector(".money").textContent=String(r.price);
    }
    shippingZones.clear();
    shippingZoneEl.innerHTML='<option value="">اختر منطقة الشحن</option>';
    for(const z of data.shippingZones||[]){
      const item={...z,fee:z.fee===null?null:Number(z.fee)};
      shippingZones.set(z.id,item);
      const o=document.createElement("option");o.value=z.id;
      o.textContent=item.fee===null?`${z.label} — السعر يُحدد لاحقًا`:`${z.label} — ${money(item.fee)}`;
      shippingZoneEl.appendChild(o);
    }
    if(!shippingZones.size)throw new Error("لا توجد مناطق شحن متاحة");
  }catch(e){
    console.warn("Public catalog fallback:",e);
    shippingZones.clear();
    shippingZones.set("other",{id:"other",label:"محافظة / منطقة أخرى",fee:null});
    shippingZoneEl.innerHTML='<option value="">اختر منطقة الشحن</option><option value="other">محافظة / منطقة أخرى — السعر يُحدد لاحقًا</option>';
  }
  applyPackage(selected);
  updatePriceSummary();
}
for(const [kind,input] of Object.entries(inputs)){input.addEventListener("change",async()=>{
  clearOrderError();
  const {rejected,compressed}=await sanitizeInputSelection(kind,input);
  renderFiles();
  const parts=[];if(compressed)parts.push(`تم ضغط ${compressed} صورة كبيرة تلقائيًا`);if(rejected.length)parts.push(rejectionSummary(rejected));if(parts.length)toast(parts.join(" · "));
})};
for(const c of document.querySelectorAll(".pkg")){c.setAttribute("role","radio");c.addEventListener("click",()=>applyPackage(c.dataset.id,{announce:true}));c.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();applyPackage(c.dataset.id,{announce:true})}})}
for(const c of document.querySelectorAll(".theme-card")){c.addEventListener("click",()=>{selectedTheme=c.dataset.theme||"black_rose";form.elements.memoryTheme.value=selectedTheme;document.querySelectorAll(".theme-card").forEach(x=>x.classList.toggle("active",x===c));updatePriceSummary()})}
shippingZoneEl.addEventListener("change",updatePriceSummary);form.elements.layoutStyle?.addEventListener("change",updatePriceSummary);

function payloadFromForm(){const fd=new FormData(form),r=packageRule(selected),rawSong=fd.get("songUrl"),songUrl=r.allowSong?httpUrl(rawSong):"";if(r.allowSong&&rawSong&&!songUrl)throw new Error("رابط الأغنية يجب أن يبدأ بـ http أو https.");const zone=selectedZone();if(!zone)throw new Error("اختار منطقة الشحن.");const fs=mainFiles(),imageCount=fs.filter(f=>kindForFile(f)==="image").length,requestedGames=collectOrderGames(imageCount);const pageCopy={pageTitle:fd.get("pageTitle")?.trim()||"",intro:"",messageTitle:"كلمة من القلب",galleryTitle:"لحظاتنا",audioTitle:"صوت من القلب",videoTitle:"لحظات حية",songSectionTitle:"أغنيتنا",closingText:fd.get("closingText")?.trim()||""};const advancedCustomization={pageTextColor:fd.get("pageTextColor")||"default",fontSize:fd.get("fontSize")||"normal",layoutStyle:fd.get("layoutStyle")||"carousel",pageEffect:fd.get("pageEffect")||"none",logoPosition:"none",engraving:fd.get("engraving")?.trim()||""};return{requestId,honeypot:fd.get("website")||"",package:selected,paymentMethod:fd.get("paymentMethod"),customization:{senderName:fd.get("senderName")?.trim(),recipientName:fd.get("recipientName")?.trim(),occasion:fd.get("occasion")?.trim(),date:fd.get("memoryDate")||null,message:fd.get("message")?.trim()||"",theme:selectedTheme,pageCopy,songTitle:r.allowSong?fd.get("songTitle")?.trim()||"":"",songUrl,acrylic:{textColor:fd.get("textColor"),layout:"signature"},advanced:advancedCustomization},shippingAddress:{street:fd.get("street")?.trim(),city:fd.get("city")?.trim(),area:fd.get("shippingArea")?.trim(),zoneId:zone.id,phone:fd.get("phone")?.trim()},requestedDeliveryDate:fd.get("deliveryDate")||null,notes:fd.get("notes")?.trim()||"",whatsappOptIn:fd.get("whatsappConsent")==="on",consent:{accepted:fd.get("legalConsent")==="on",version:(window.LAMSA_CONFIG?.LEGAL_VERSION||"2026-09-11")},requestedGames,uploads:fs.map((f,clientIndex)=>({clientIndex,name:safeFilename(f.name),kind:kindForFile(f),mimeType:f.type,size:f.size}))}}
async function uploadSigned(ticket,file,onProgress){let lastError=null;for(let attempt=1;attempt<=2;attempt++){onProgress?.(0,file.size);try{const url=`/upload/order?path=${encodeURIComponent(ticket.path)}&token=${encodeURIComponent(ticket.token)}`;const r=await fetch(url,{method:"PUT",headers:{"Content-Type":file.type},body:file});const data=await r.json().catch(()=>({}));if(r.ok){onProgress?.(file.size,file.size);return}const err=new Error(data.error||`تعذر رفع الملف (${r.status})`);err.status=r.status;lastError=err}catch(e){lastError=e}if(attempt<2)await new Promise(r=>setTimeout(r,700))}throw lastError||new Error("تعذر رفع الملف.")}
submit.onclick=async()=>{if(submit.disabled)return;clearOrderError();if(location.protocol!=="http:"&&location.protocol!=="https:"){showOrderError("لا يمكن إرسال طلب من ملف HTML المفتوح على الجهاز. افتح الموقع المنشور على Cloudflare Pages ثم أرسل الطلب.",submit);return}if(!form.reportValidity()){const bad=form.querySelector(":invalid");showOrderError(invalidFieldMessage(bad),bad);return}const all=selectedFiles(),fs=mainFiles(),special=specialFiles();try{validateFiles(all)}catch(e){showOrderError(e.message,cards.image);toast(e.message);return}submit.disabled=true;progress.classList.add("show");bar.style.width="8%";progressText.textContent="جاري تجهيز الطلب…";let result=null;try{const p=payloadFromForm();progressText.textContent="جاري إنشاء الطلب…";result=await functionPost("create-order",p);bar.style.width="20%";for(let i=0;i<result.uploads.length;i++){const t=result.uploads[i],f=fs[Number(t.clientIndex)];if(!f)throw new Error("حدث خطأ في مطابقة أحد الملفات.");if(!t.alreadyUploaded){await uploadSigned(t,f,(done,total)=>{const fileRatio=total?done/total:0,overall=(i+fileRatio)/Math.max(1,result.uploads.length);bar.style.width=`${20+Math.round(overall*72)}%`;progressText.textContent=`رفع ${f.name} — ${Math.round(fileRatio*100)}% (${i+1}/${result.uploads.length})`})}else{const overall=(i+1)/Math.max(1,result.uploads.length);bar.style.width=`${20+Math.round(overall*72)}%`;progressText.textContent=`تم العثور على ${f.name} مرفوعًا بالفعل (${i+1}/${result.uploads.length})`}}progressText.textContent="فحص الملفات وتأكيد الطلب…";const completed=await functionPost("complete-order",{orderNumber:result.orderNumber,trackingToken:result.trackingToken});let specialWarning="";if(p.requestedGames.length){try{progressText.textContent="حفظ اختيارات الألعاب…";await functionPost("order-wow-selection",{orderNumber:result.orderNumber,trackingToken:result.trackingToken,games:p.requestedGames})}catch(gameError){specialWarning=String(gameError?.message||"تعذر حفظ اختيارات الألعاب");console.warn("order games save failed",gameError)}};if(special.length){try{progressText.textContent="رفع صورة الكوفر والخلفية…";const prep=await functionPost("attach-special-media",{orderNumber:result.orderNumber,trackingToken:result.trackingToken,stage:"prepare",files:special.map(x=>({kind:x.kind,name:safeFilename(x.file.name),mimeType:x.file.type,size:x.file.size}))});for(const t of prep.uploads||[]){const item=special.find(x=>x.kind===t.kind);if(!item)throw new Error("تعذر مطابقة صورة الكوفر أو الخلفية.");await uploadSigned(t,item.file)}await functionPost("attach-special-media",{orderNumber:result.orderNumber,trackingToken:result.trackingToken,stage:"finalize"})}catch(specialError){specialWarning=String(specialError?.message||"تعذر رفع صورة الكوفر أو الخلفية");console.warn("special media upload failed",specialError)}}bar.style.width="100%";progressText.textContent="تم إنشاء الطلب ورفع الملفات بنجاح";sessionStorage.setItem("lamsa_track_token",result.trackingToken);sessionStorage.setItem("lamsa_track_order",result.orderNumber);sessionStorage.setItem("lamsa_order_whatsapp_status",completed?.whatsappStatus||"");if(specialWarning)sessionStorage.setItem("lamsa_special_media_warning",specialWarning);else sessionStorage.removeItem("lamsa_special_media_warning");try{await functionPost("order-notify-admin",{orderNumber:result.orderNumber,trackingToken:result.trackingToken})}catch(notifyError){console.warn("admin notification dispatch failed",notifyError)}sessionStorage.removeItem("lamsa_order_request_id");requestId=crypto.randomUUID();setTimeout(()=>location.href=`order-success.html?order=${encodeURIComponent(result.orderNumber)}`,250)}catch(e){console.error(e);try{if(result?.orderNumber&&result?.trackingToken){await functionPost("abort-order",{orderNumber:result.orderNumber,trackingToken:result.trackingToken});sessionStorage.removeItem("lamsa_order_request_id");requestId=crypto.randomUUID();sessionStorage.setItem("lamsa_order_request_id",requestId)}}catch(cleanupError){console.error("abort-order cleanup failed",cleanupError)}showOrderError(e.message||"حدث خطأ غير متوقع أثناء إرسال الطلب.",submit);toast(e.message||"حدث خطأ");progressText.textContent="تعذر إكمال الطلب — تم تنظيف الطلب غير المكتمل قدر الإمكان";bar.style.width="0%"}finally{submit.disabled=false}};

loadCatalog();
if(location.protocol!=="http:"&&location.protocol!=="https:")showOrderError("أنت فاتح نسخة محلية. المعاينة تعمل، لكن إرسال الطلبات يعمل فقط من الموقع المنشور على Cloudflare Pages.",submit);
