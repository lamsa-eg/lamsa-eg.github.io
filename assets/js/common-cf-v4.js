export function cfg(){ return window.LAMSA_CONFIG || {}; }
export function configured(){
  const c=cfg(); return c.SUPABASE_URL && !c.SUPABASE_URL.startsWith("__") &&
    c.SUPABASE_PUBLISHABLE_KEY && !c.SUPABASE_PUBLISHABLE_KEY.startsWith("__");
}
export function money(v){ return new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(Number(v||0)); }
export function qs(name){ return new URLSearchParams(location.search).get(name); }
export function escapeHtml(s=""){ return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
export function toast(msg){
  let t=document.getElementById("toast");
  if(!t){t=document.createElement("div");t.id="toast";t.className="toast";document.body.appendChild(t);}
  t.textContent=msg;t.classList.add("show");clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),2800);
}
export function reveal(){
  if(!("IntersectionObserver" in window)){document.querySelectorAll("[data-reveal]").forEach(e=>e.classList.add("visible"));return;}
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("visible");io.unobserve(e.target)}}),{threshold:.08});
  document.querySelectorAll("[data-reveal]").forEach(e=>io.observe(e));
}
export function safeFilename(name="file"){
  const safe=String(name).normalize("NFKD").replace(/[^\w.\-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(-100);
  return safe || "file";
}
export function fileKind(file){
  if(file.type.startsWith("image/")) return "image";
  if(file.type.startsWith("video/")) return "video";
  if(file.type.startsWith("audio/")) return "audio";
  return "other";
}
export function httpUrl(value){
  if(!value) return "";
  try{const u=new URL(String(value).trim());return ["http:","https:"].includes(u.protocol)?u.href:""}catch{return ""}
}
export function siteUrl(){
  const raw=String(cfg().SITE_URL||"").trim();
  if(raw){try{const u=new URL(raw);if(u.protocol==="https:")return u.origin}catch{}}
  return location.origin;
}
export function memoryUrl(slug){
  const s=String(slug||"").trim();
  if(!/^m-[a-f0-9]{16}(?:[a-f0-9]{16})?$/i.test(s)) return "";
  return `${siteUrl().replace(/\/$/,"")}/m/${encodeURIComponent(s)}`;
}
export function validMemoryUrl(value){
  try{
    const u=new URL(String(value||"").trim());
    const root=new URL(siteUrl());
    return u.protocol==="https:"&&u.origin===root.origin&&/^\/m\/m-[a-f0-9]{16}(?:[a-f0-9]{16})?$/i.test(u.pathname)&&!u.search&&!u.hash;
  }catch{return false}
}
export const PACKAGE_INFO = {
  mini:{
    id:"mini",label:"Mini",price:299,desc:"3 صور + رسالة",
    maxImages:3,maxImageBytes:8*1024*1024,
    allowVideo:false,maxVideoBytes:0,allowAudio:false,maxAudioBytes:0,allowSong:false
  },
  memory:{
    id:"memory",label:"Memory",price:449,desc:"8 صور + رسالة + أغنية",
    maxImages:8,maxImageBytes:8*1024*1024,
    allowVideo:false,maxVideoBytes:0,allowAudio:false,maxAudioBytes:0,allowSong:true
  },
  premium:{
    id:"premium",label:"Premium",price:699,desc:"12 صورة + فيديو + صوت + أغنية",
    maxImages:12,maxImageBytes:8*1024*1024,
    allowVideo:true,maxVideoBytes:50*1024*1024,allowAudio:true,maxAudioBytes:15*1024*1024,allowSong:true
  }
};
export function packageRule(id){ return PACKAGE_INFO[id] || PACKAGE_INFO.memory; }
export function applyPackageRows(rows=[]){
  for(const row of rows){
    if(!PACKAGE_INFO[row.id]) continue;
    Object.assign(PACKAGE_INFO[row.id],{
      label:row.label||PACKAGE_INFO[row.id].label,
      price:Number(row.price??PACKAGE_INFO[row.id].price),
      maxImages:Number(row.max_images??PACKAGE_INFO[row.id].maxImages),
      maxImageBytes:Number(row.max_image_bytes??PACKAGE_INFO[row.id].maxImageBytes),
      allowVideo:Boolean(row.allow_video),
      maxVideoBytes:Number(row.max_video_bytes??0),
      allowAudio:Boolean(row.allow_audio),
      maxAudioBytes:Number(row.max_audio_bytes??0),
      allowSong:Boolean(row.allow_song)
    });
  }
}
