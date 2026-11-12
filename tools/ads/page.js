const k = new URLSearchParams(location.search).get("k") || "avatar";
document.body.insertAdjacentHTML("beforeend", k === "avatar"
  ? `<div class="avatar"><div><i>✦</i><b>لمسة</b><small>LAMSA</small></div></div>`
  : `<div class="cover"><div><span class="chip">هدية تتلمس · NFC + QR</span><h1>مش صفحة صور…<span>دي رحلة من قصتكم.</span></h1><p>صوركم ورسايلكم وأغنيتكم، وألعاب من إجاباتكم.</p></div><div class="arch"><img src="/assets/img/scene-gift.svg" alt=""></div></div>`);
