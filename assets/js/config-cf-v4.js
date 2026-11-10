window.LAMSA_CONFIG = {
  SUPABASE_URL: "https://qwavanugzcjevhtzjfuo.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_mgNBl4z3uAsh4GLibYzPKw_tQLb-ZF0",
  SITE_URL: "https://lamsagift.pages.dev",
  BRAND_NAME: "LAMSA",
  CURRENCY: "EGP",
  LEGAL_VERSION: "2026-09-11",
  BUILD_VERSION: "cf-v39-nile-sunset"
};

if(location.pathname.endsWith("order-success.html"))addEventListener("DOMContentLoaded",()=>{
  const pricing=document.getElementById("pricing"),wow=Number(sessionStorage.getItem("lamsa_wow_price")||0),games=Number(sessionStorage.getItem("lamsa_wow_games")||0);
  if(pricing&&(wow||games))pricing.querySelector(".r:last-child")?.insertAdjacentHTML("beforebegin",`<div class="r"><span>ألعاب وإضافات واو (${games})</span><b>${wow?`${wow} ج.م`:"ضمن الباقة"}</b></div>`);
  const box=document.querySelector(".box");if(box&&!document.getElementById("reactionInvite")){const invite=document.createElement("div");invite.id="reactionInvite";invite.className="secret";invite.innerHTML='<b style="display:block;margin-bottom:6px">صوّر لحظة فتح الهدية 🎥</b><span>لو صاحب الهدية موافق، صوّر رد فعله وابعت الفيديو لنا. بعد المراجعة هتاخد كوبون لطلبك الجاي.</span><br><a class="heart-outline-btn" style="margin-top:10px" href="https://wa.me/201588889741?text=عندي%20فيديو%20فتح%20هدية%20لمسة" target="_blank" rel="noopener">ابعت الفيديو بموافقته</a>';box.appendChild(invite)}
});
