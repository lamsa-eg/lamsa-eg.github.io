import{reveal}from"./common-cf-v4.js";
import{loadPublicConfig}from"./public-client-v18.js";

reveal();

const demos={
  story:{kicker:"لعبة من حكايتكم",title:"رتّب الحكاية",copy:"حط اللحظات بالترتيب اللي حصلت بيه، وبعد آخر صورة المفاجأة تفتح.",ui:'<div class="story-tiles"><i>1</i><i>?</i><i>3</i><i>?</i></div>',action:"رتّب الصور"},
  wrapped:{kicker:"من شاتكم الحقيقي",title:"Love Wrapped",copy:"إحصائيات ممتعة من كلامكم: عدد الرسائل، مين بدأ أكتر، وأكتر إيموجي بينكم.",ui:'<div class="wrapped-stat"><strong>24,860</strong><span>رسالة بينكم ♡</span></div>',action:"شوف الكارت اللي بعده"},
  touch:{kicker:"في نفس اللحظة",title:"لمسة عن بُعد",copy:"افتحوا الذكرى من جهازين والمسوا القلب. لما اللمستين يتقابلوا، المفاجأة تفتح.",ui:'<div class="touch-demo"><b>♡</b><span>حط صباعك هنا</span></div>',action:"ابعت لمسة"},
  open:{kicker:"رسالة لوقتها",title:"افتح لما…",copy:"ظروف صغيرة: لما توحشني، لما تزعل، أو في يوم مخصوص. بعضها يفضل مقفول لميعاده.",ui:'<div class="letters-demo"><span>لما توحشني</span><span>يوم 14 فبراير 🔒</span></div>',action:"افتح الظرف الأول"}
};
const title=document.querySelector("[data-demo-title]"),copy=document.querySelector("[data-demo-copy]"),kicker=document.querySelector("[data-demo-kicker]"),ui=document.querySelector("[data-demo-ui]"),action=document.querySelector("[data-demo-action]");
function chooseDemo(key){const d=demos[key]||demos.story;document.querySelectorAll(".exp-tab").forEach(x=>{const on=x.dataset.exp===key;x.classList.toggle("active",on);x.setAttribute("aria-selected",String(on))});kicker.textContent=d.kicker;title.textContent=d.title;copy.textContent=d.copy;ui.innerHTML=d.ui;action.textContent=d.action;ui.animate?.([{opacity:.15,transform:"translateY(7px)"},{opacity:1,transform:"none"}],{duration:300,easing:"ease-out"})}
document.querySelectorAll(".exp-tab").forEach(x=>x.addEventListener("click",()=>chooseDemo(x.dataset.exp)));
action?.addEventListener("click",()=>{const key=document.querySelector(".exp-tab.active")?.dataset.exp||"story";if(key==="story")ui.querySelectorAll("i").forEach((x,n)=>{x.textContent=n+1;x.style.background="rgba(183,99,117,.28)"});if(key==="wrapped"){const n=ui.querySelector("strong");if(n)n.animate([{transform:"scale(.8)"},{transform:"scale(1.13)"},{transform:"scale(1)"}],{duration:450})}if(key==="touch"){const h=ui.querySelector("b");h?.animate([{transform:"scale(1)"},{transform:"scale(1.55)",color:"#efb5c1"},{transform:"scale(1)"}],{duration:700})}if(key==="open"){const l=ui.querySelector("span");if(l){l.textContent="وجودك أمان حتى من بعيد ♡";l.style.color="#efbcc7"}}});

document.querySelectorAll(".faq-list details").forEach(d=>d.addEventListener("toggle",()=>{if(!d.open)return;document.querySelectorAll(".faq-list details").forEach(x=>{if(x!==d)x.open=false})}));

async function catalog(){try{const d=await loadPublicConfig(),byId=new Map((d.packages||[]).map(p=>[p.id,p]));document.querySelectorAll("[data-package-card]").forEach(card=>{const p=byId.get(card.dataset.packageCard);if(!p)return;card.querySelector("h3").textContent=p.label||card.querySelector("h3").textContent;card.querySelector("[data-package-price]").innerHTML=`${Number(p.price)} <small>ج.م</small>`});const mini=byId.get("mini");if(mini)document.querySelector("[data-mobile-price]").textContent=`${Number(mini.price)} ج.م`;const status=document.querySelector("[data-prices-status]");if(status)status.textContent="الأسعار محدثة من النظام";const banner=document.querySelector("[data-season-banner]");if(banner&&d.season){const cutoff=d.season.order_cutoff?new Date(d.season.order_cutoff).toLocaleDateString("ar-EG",{day:"numeric",month:"long"}):"";banner.textContent=`${d.season.banner_text||d.season.name}${cutoff?` — آخر طلب مضمون: ${cutoff}`:""}`;banner.classList.add("show")}}catch(e){console.warn("catalog fallback",e);const status=document.querySelector("[data-prices-status]");if(status)status.textContent="الأسعار الأساسية معروضة"}}
catalog();
