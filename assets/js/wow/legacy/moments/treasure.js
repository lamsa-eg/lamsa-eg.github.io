/* treasure hunt — N physical NFC stickers hidden around the house.
   Each sticker opens /m/<slug>?clue=<n>&k=<token>; the server validates the token and advances progress.
   In the demo, a "simulate tap" button stands in for the physical sticker. */
LAMSA_WOW.register("treasure", function (ctx, sec, cfg) {
  var clues = cfg.clues || [];
  var total = clues.length;
  var st = ctx.state.get() || { step: 0 };
  var validated = sessionStorage.getItem("lamsa-hunt-step:" + ctx.memory.slug);
  var urlStep = validated === null ? 0 : Number(validated) + 1;
  if (urlStep > st.step && urlStep <= total) { st.step = urlStep; ctx.state.set(st); }
  var box = ctx.h("div", "wow-hunt");
  sec.appendChild(box);
  function render() {
    var n = st.step;
    var dots = clues.map(function (_, i) { return '<span class="' + (i < n ? "on" : "") + '"></span>'; }).join("");
    if (n >= total) {
      box.innerHTML = '<div class="wow-hunt-dots">' + dots + '</div><div class="wow-hunt-final">🗝️ ' + ctx.esc(cfg.finalTitle || "لقيتي الكنز!") + '</div><p class="wow-hand">' + ctx.esc(cfg.finalText || "") + "</p>";
      return;
    }
    var c = clues[n];
    box.innerHTML = '<div class="wow-hunt-dots">' + dots + "</div>" +
      '<div class="wow-hunt-step">اللغز ' + ctx.ar(n + 1) + " من " + ctx.ar(total) + "</div>" +
      '<p class="wow-hunt-clue">' + ctx.esc(c.text) + "</p>" +
      (c.hint ? '<details class="wow-hunt-hint"><summary>محتاجة مساعدة؟</summary>' + ctx.esc(c.hint) + "</details>" : "") +
      '<div class="wow-hunt-tap"><span class="wow-nfc" aria-hidden="true"></span>لما تلاقي الستيكر، قرّبي الموبايل منه</div>' +
      "";
  }
  function advance() {
    st.step++; ctx.state.set(st); ctx.vib([40, 30, 80]);
    if (st.step >= total) { ctx.confetti(180); ctx.event("hunt_done", null, cfg.notifyDone || "خلصت صيد الكنز ولقت الهدية 🗝️"); }
    else { ctx.confetti(40); ctx.event("hunt_step", { step: ctx.ar(st.step) }, cfg.notifyStep || "لقت الستيكر رقم {step}"); }
    render();
  }
  render();
});
