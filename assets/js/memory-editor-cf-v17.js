import * as tus from "https://cdn.jsdelivr.net/npm/tus-js-client@4.3.1/+esm";
import{qs,toast,fileKind,safeFilename,packageRule,httpUrl,escapeHtml,applyPackageRows,memoryUrl}from"./common-cf-v4.js";
import{db,requireAdmin,functionPost}from"./client-cf-v4.js";
import{optimizeImageFile}from"./image-optimize-v26.js";
let memoryId=qs("id"),mem,media=[],packageId="memory",orderId="",adminCtx=null;
const ALLOWED={image:new Set(["image/jpeg","image/png","image/webp"]),video:new Set(["video/mp4","video/quicktime"]),audio:new Set(["audio/mpeg","audio/mp4","audio/x-m4a","audio/wav"])};
function attr(v){return escapeHtml(v??"")}
async function loadPackageConfig(s){try{const{data}=await s.from("packages").select("id,label,price,max_images,max_image_bytes,allow_video,max_video_bytes,allow_audio,max_audio_bytes,allow_song").eq("active",true);applyPackageRows(data||[])}catch(e){console.warn(e)}}
async function showPicker(s){
  const{data,error}=await s.from("memories").select("id,sender_name,recipient_name,is_published,created_at,orders(id,order_number,package_id,submission_state)").order("created_at",{ascending:false}).limit(100);if(error){toast(error.message);return}
  const main=document.querySelector("main.content");
  main.innerHTML=`<div class="adminhead"><div><span class="kicker">MEMORY EDITOR</span><h1 class="title">اختر الذكرى.</h1><p class="copy">اختر أي ذكرى، وبعد فتحها ستجد قسم <b>WOW · GAMES</b> أسفل بيانات الذكرى.</p></div><a class="heart-outline-btn" href="dashboard.html">الطلبات</a></div><section class="card" style="padding:20px"><div style="display:grid;gap:10px">${(data||[]).filter(x=>{const o=Array.isArray(x.orders)?x.orders[0]:x.orders;return o?.submission_state==="complete"}).map(x=>{const o=Array.isArray(x.orders)?x.orders[0]:x.orders;return `<a class="card" style="padding:16px;display:flex;justify-content:space-between;gap:14px;align-items:center" href="memory-editor.html?id=${encodeURIComponent(x.id)}"><div><b>${escapeHtml(o?.order_number||"طلب")}</b><div class="muted small" style="margin-top:6px">${escapeHtml(x.sender_name||"")} ← ${escapeHtml(x.recipient_name||"")} · ${escapeHtml(packageRule(o?.package_id).label)}</div></div><span class="pill">فتح التحرير والألعاب · ${x.is_published?"منشورة":"مسودة"}</span></a>`}).join("")||'<div class="muted">لا توجد ذكريات.</div>'}</div></section>`;
}

function projectId(){try{return new URL(window.LAMSA_CONFIG?.SUPABASE_URL||"").hostname.split(".")[0]}catch{return ""}}
async function uploadAdminResumable(path,file){
  const s=db(),pid=projectId();if(!s||!pid)throw new Error("تعذر الاتصال بالتخزين.");
  const{data:{session},error}=await s.auth.getSession();if(error||!session?.access_token)throw new Error("انتهت جلسة الإدارة. سجّل الدخول من جديد.");
  return new Promise((resolve,reject)=>{
    const upload=new tus.Upload(file,{
      endpoint:`https://${pid}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays:[0,1000,3000,5000,10000,20000],
      headers:{authorization:`Bearer ${session.access_token}`,apikey:window.LAMSA_CONFIG?.SUPABASE_PUBLISHABLE_KEY||""},
      uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,
      metadata:{bucketName:"memory-media",objectName:path,contentType:file.type,cacheControl:"3600"},
      chunkSize:6*1024*1024,onError:reject,onSuccess:()=>resolve(upload.url)
    });
    upload.findPreviousUploads().then(prev=>{if(prev.length)upload.resumeFromPreviousUpload(prev[0]);upload.start()}).catch(reject);
  });
}
async function imageIsReadable(file){
  if(!file||file.size<=0)return false;
  try{if("createImageBitmap" in window){const bmp=await createImageBitmap(file);const ok=Number(bmp.width)>0&&Number(bmp.height)>0;bmp.close?.();if(ok)return true}}catch{}
  return await new Promise(resolve=>{const url=URL.createObjectURL(file),img=new Image();const done=v=>{URL.revokeObjectURL(url);resolve(v)};img.onload=()=>done(img.naturalWidth>0&&img.naturalHeight>0);img.onerror=()=>done(false);img.src=url});
}
function skippedSummary(items){
  if(!items.length)return "";
  const details=items.slice(0,2).map(x=>`${x.file.name}: ${x.reason}`).join(" · ");
  return `تم تجاهل ${items.length} ملف${items.length>1?"ات":""} غير صالح${items.length>1?"ة":""}${details?` — ${details}`:""}${items.length>2?" …":""}`;
}
async function filterAdminFiles(fs){
  const r=packageRule(packageId);
  const used={image:media.filter(x=>["image","cover"].includes(x.kind)).length,video:media.filter(x=>x.kind==="video").length,audio:media.filter(x=>x.kind==="audio").length};
  const add={image:0,video:0,audio:0},valid=[],rejected=[];let compressed=0;
  for(const original of fs){
    let f=original,k=fileKind(f),reason="";
    if(!Object.hasOwn(add,k)||!ALLOWED[k]?.has(f.type))reason="النوع أو الصيغة غير مدعومة";
    else if(f.size<=0)reason="الملف فارغ أو تالف";
    else if(k==="image"&&used.image+add.image>=r.maxImages)reason=`تجاوز حد ${r.maxImages} صور للباقة`;
    else if(k==="video"&&!r.allowVideo)reason="الفيديو غير متاح في هذه الباقة";
    else if(k==="video"&&f.size>r.maxVideoBytes)reason="الفيديو أكبر من الحد المسموح";
    else if(k==="video"&&used.video+add.video>=1)reason="مسموح فيديو واحد فقط";
    else if(k==="audio"&&!r.allowAudio)reason="الصوت غير متاح في هذه الباقة";
    else if(k==="audio"&&f.size>r.maxAudioBytes)reason="الصوت أكبر من الحد المسموح";
    else if(k==="audio"&&used.audio+add.audio>=1)reason="مسموح تسجيل صوتي واحد فقط";
    if(!reason&&k==="image"){
      try{const optimized=await optimizeImageFile(f,r.maxImageBytes,{maxDimension:2560});f=optimized.file;if(optimized.compressed)compressed++;k="image";}
      catch(e){reason=e?.message||`تعذر ضغط الصورة لأقل من ${Math.round(r.maxImageBytes/1024/1024)}MB`;}
    }
    if(!reason&&k==="image"&&!(await imageIsReadable(f)))reason="الصورة غير قابلة للقراءة أو تالفة";
    if(reason)rejected.push({file:original,reason});else{add[k]++;valid.push(f)}
  }
  return{valid,rejected,compressed};
}
function applyEditorRules(){const r=packageRule(packageId),input=document.getElementById("mediaFiles");input.accept="image/jpeg,image/png,image/webp"+(r.allowVideo?",video/mp4,video/quicktime":"")+(r.allowAudio?",audio/mpeg,audio/mp4,audio/x-m4a,audio/wav":"");document.getElementById("packageInfo").textContent=`${r.label}: ${r.maxImages} صور · الصور الكبيرة تُضغط تلقائيًا${r.allowVideo?" + فيديو":""}${r.allowAudio?" + صوت":""}`;document.getElementById("songWrap").classList.toggle("hidden",!r.allowSong)}
async function load(){
  const a=await requireAdmin();if(!a)return;adminCtx=a;const s=db();await loadPackageConfig(s);if(!memoryId){await showPicker(s);return}
  const{data,error}=await s.from("memories").select("*,orders(id,order_number,package_id,submission_state)").eq("id",memoryId).single();if(error){toast("تعذر فتح الذكرى المطلوبة");return}
  mem=data;const order=Array.isArray(data.orders)?data.orders[0]:data.orders;if(order?.submission_state!=="complete"){toast("لا يمكن تحرير أو نشر ذكرى لطلب لم يكتمل رفعه والتحقق منه.");location.href="dashboard.html";return}packageId=order?.package_id||"memory";orderId=order?.id||"";
  document.getElementById("editorSubtitle").textContent=`${order?.order_number||""} — ${mem.sender_name||""} ← ${mem.recipient_name||""}`;const back=document.getElementById("orderBack");if(orderId){back.href=`order-detail.html?id=${encodeURIComponent(orderId)}`;back.classList.remove("hidden")}
  document.getElementById("sender").value=mem.sender_name||"";document.getElementById("recipient").value=mem.recipient_name||"";document.getElementById("memoryDate").value=mem.memory_date||"";document.getElementById("intro").value=mem.intro||"";document.getElementById("message").value=mem.message||"";document.getElementById("songTitle").value=mem.song_title||"";document.getElementById("songUrl").value=mem.song_url||"";document.getElementById("published").textContent=mem.is_published?"منشورة":"غير منشورة";document.getElementById("frame").src=`../memory.html?preview=${encodeURIComponent(memoryId)}`;applyEditorRules();await loadMedia();
}
async function loadMedia(){
  const s=db();const{data,error}=await s.from("memory_media").select("*").eq("memory_id",memoryId).order("sort_order").order("created_at");if(error){toast(error.message);return}media=data||[];
  const urlMap=new Map();for(const x of media){const bucket=x.storage_bucket||"memory-media";const{data:signed,error:se}=await s.storage.from(bucket).createSignedUrl(x.storage_path,900);if(!se&&signed?.signedUrl)urlMap.set(`${bucket}:${x.storage_path}`,signed.signedUrl)}
  document.getElementById("media").innerHTML=media.map((x,i)=>{const bucket=x.storage_bucket||"memory-media",u=urlMap.get(`${bucket}:${x.storage_path}`)||"",thumb=["image","cover","logo","background"].includes(x.kind)&&u?`<img class="thumb" loading="lazy" decoding="async" src="${attr(u)}" alt="">`:`<div class="thumb" style="display:grid;place-items:center">${x.kind==="video"?"▷":x.kind==="audio"?"◉":"◇"}</div>`;return `<div class="media">${thumb}<div><b>${escapeHtml(x.kind)}</b><div class="muted small">${escapeHtml(x.caption||x.storage_path)}</div><div class="muted small">${bucket==="order-uploads"?"ملف العميل الأصلي":"وسائط الذكرى"}</div><div style="display:flex;gap:5px;margin-top:7px"><button class="btn ghost" data-move="-1" data-index="${i}" ${i===0?"disabled":""}>↑</button><button class="btn ghost" data-move="1" data-index="${i}" ${i===media.length-1?"disabled":""}>↓</button></div></div><button class="btn danger" data-del="${attr(x.id)}" data-path="${attr(x.storage_path)}" data-bucket="${attr(bucket)}" style="padding:8px 10px">حذف</button></div>`}).join("")||'<div class="muted small">لا توجد وسائط.</div>';
  document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>removeMedia(b.dataset.del,b.dataset.path,b.dataset.bucket));document.querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>moveMedia(Number(b.dataset.index),Number(b.dataset.move)));
}
async function moveMedia(index,delta){const target=index+delta;if(target<0||target>=media.length)return;const reordered=[...media];[reordered[index],reordered[target]]=[reordered[target],reordered[index]];const s=db();const results=await Promise.all(reordered.map((x,i)=>s.from("memory_media").update({sort_order:i}).eq("id",x.id)));const failed=results.find(x=>x.error);if(failed){toast(failed.error.message);return}media=reordered;await loadMedia();refreshPreview()}
function refreshPreview(){document.getElementById("frame").src=`../memory.html?preview=${encodeURIComponent(memoryId)}&t=${Date.now()}`}
async function save(){const s=db(),r=packageRule(packageId),song=r.allowSong?httpUrl(document.getElementById("songUrl").value):"";if(r.allowSong&&document.getElementById("songUrl").value.trim()&&!song){toast("رابط الأغنية غير صالح.");return}const update={sender_name:document.getElementById("sender").value.trim(),recipient_name:document.getElementById("recipient").value.trim(),memory_date:document.getElementById("memoryDate").value||null,intro:document.getElementById("intro").value.trim(),message:document.getElementById("message").value.trim(),song_title:r.allowSong?document.getElementById("songTitle").value.trim():"",song_url:song||null,updated_at:new Date().toISOString()};const{error}=await s.from("memories").update(update).eq("id",memoryId);if(error)toast(error.message);else{Object.assign(mem,update);toast("تم الحفظ");refreshPreview()}}
async function uploadFiles(fs){
  const {valid,rejected,compressed}=await filterAdminFiles(fs);
  const notices=[];if(compressed)notices.push(`تم ضغط ${compressed} صورة كبيرة تلقائيًا`);if(rejected.length)notices.push(skippedSummary(rejected));if(notices.length)toast(notices.join(" · "));
  if(!valid.length)return;
  const s=db();let base=media.length,uploaded=0,failed=[];
  for(const f of valid){
    const kind=fileKind(f),path=`${memoryId}/${crypto.randomUUID()}-${safeFilename(f.name)}`;
    try{await uploadAdminResumable(path,f)}catch(e){console.error(e);failed.push(f.name);continue}
    const{error:dbErr}=await s.from("memory_media").insert({memory_id:memoryId,kind,storage_bucket:"memory-media",storage_path:path,caption:f.name,sort_order:base+uploaded});
    if(dbErr){await s.storage.from("memory-media").remove([path]);failed.push(f.name);continue}
    uploaded++;
  }
  await loadMedia();refreshPreview();
  if(failed.length)toast(`تم رفع ${uploaded} ملف، وتعذر رفع ${failed.length} فقط.`);else if(rejected.length)toast(`تم رفع ${uploaded} ملف صالح، وتم تجاهل ${rejected.length} غير صالح.`);else if(compressed)toast(`تم ضغط ورفع ${compressed} صورة كبيرة، وإجمالي ${uploaded} ملف بنجاح.`);else toast(`تم رفع ${uploaded} ملف بنجاح.`);
}
async function removeMedia(id,path,bucket){const target=media.find(x=>String(x.id)===String(id));if(mem?.is_published&&target&&["image","cover"].includes(target.kind)&&media.filter(x=>["image","cover"].includes(x.kind)).length<=1){toast("لا يمكن حذف آخر صورة من ذكرى منشورة. ألغِ النشر أولًا أو أضف صورة أخرى.");return}const s=db();const{error:e1}=await s.from("memory_media").delete().eq("id",id);if(e1){toast(e1.message);return}if((bucket||"memory-media")==="memory-media"){const{error:e2}=await s.storage.from("memory-media").remove([path]);if(e2)console.warn("orphan media cleanup failed",e2)}toast("تم الحذف");await loadMedia();refreshPreview()}
document.getElementById("save").onclick=save;document.getElementById("togglePublish").onclick=async()=>{const s=db();if(!mem)return;if(!mem.is_published&&!media.some(x=>["image","cover"].includes(x.kind))){toast("أضف صورة واحدة على الأقل قبل النشر.");return}const next=!mem.is_published;const{error}=await s.from("memories").update({is_published:next,updated_at:new Date().toISOString()}).eq("id",memoryId);if(error)toast(error.message);else{mem.is_published=next;document.getElementById("published").textContent=next?"منشورة":"غير منشورة";toast(next?`تم النشر: ${memoryUrl(mem.slug)}`:"تم إلغاء النشر");if(next&&adminCtx?.session?.access_token){functionPost("admin-notifications",{action:"push-event",eventKey:`memory:${memoryId}:published`},adminCtx.session.access_token).catch(e=>console.warn("memory push",e))}}};document.getElementById("mediaFiles").onchange=e=>{const fs=[...e.target.files];e.target.value="";uploadFiles(fs)};load();
