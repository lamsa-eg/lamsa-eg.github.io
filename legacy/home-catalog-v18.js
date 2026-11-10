import{loadPublicConfig}from"./public-client-v18.js";
import{money}from"./common-cf-v4.js";
async function run(){
  try{
    const d=await loadPublicConfig();
    const byId=new Map((d.packages||[]).map(p=>[p.id,p]));
    document.querySelectorAll("[data-package-card]").forEach(card=>{
      const p=byId.get(card.dataset.packageCard);if(!p)return;
      const price=card.querySelector("[data-package-price]");
      if(price)price.innerHTML=`${Number(p.price)} <small>ج.م</small>`;
      const title=card.querySelector("h3");if(title)title.textContent=p.label||title.textContent;
    });
    const stamp=document.querySelector("[data-prices-status]");
    if(stamp)stamp.textContent="الأسعار محدثة من النظام";
    const banner=document.querySelector("[data-season-banner]");if(banner&&d.season){const cutoff=d.season.order_cutoff?new Date(d.season.order_cutoff).toLocaleDateString("ar-EG",{day:"numeric",month:"long"}):"";banner.textContent=`${d.season.banner_text||d.season.name}${cutoff?` — آخر طلب مضمون: ${cutoff}`:""}`;banner.classList.add("show")}
  }catch(e){
    console.warn("catalog fallback",e);
    const stamp=document.querySelector("[data-prices-status]");
    if(stamp)stamp.textContent="الأسعار الأساسية معروضة";
  }
}
run();
