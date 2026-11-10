/* coupons — each redeemable once; sender is notified.
   Production: redeem via POST /api/wow-coupon-redeem (server sets redeemed_at). */
LAMSA_WOW.register("coupons", function (ctx, sec, cfg) {
  var used = ctx.state.get() || {};
  var list = ctx.h("div", "wow-coupons");
  var guard = ctx.h("div", "wow-turnstile-slot"), ts = null; sec.appendChild(guard);ctx.mountTurnstile(guard).then(function(x){ts=x}).catch(function(e){guard.textContent=e.message});
  (cfg.items || []).forEach(function (c, i) {
    var el = ctx.h("div", "wow-cp" + (used[i] ? " used" : ""));
    el.innerHTML = "<div><b>" + ctx.esc(c.title) + "</b><small>" + ctx.esc(c.subtitle || "") + '</small></div><button type="button">' + (used[i] ? "اتستخدم" : "استخدميه") + '</button><span class="wow-cp-st">اتستخدم</span>';
    var b = el.querySelector("button"); if (used[i]) b.disabled = true;
    b.onclick = async function () {
      if (used[i]) return;var token=ts&&ts.getToken();if(!token){ctx.toast("كمّل خطوة الحماية الأول");return}b.disabled=true;
      try{await ctx.event("redeem", { coupon: c.title },{turnstileToken:token});used[i] = Date.now(); ctx.state.set(used);el.classList.add("used"); b.textContent = "اتستخدم";ctx.vib([30, 30, 90]); ctx.confetti(60);ts.reset()}catch(e){b.disabled=false;ctx.toast(e.message||"تعذر استخدام الكوبون");ts.reset()}
    };
    list.appendChild(el);
  });
  sec.appendChild(list);
});
