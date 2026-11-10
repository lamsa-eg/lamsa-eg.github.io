/* game: quiz (مين فينا؟) — always ends; reward shown after the last question */
LAMSA_WOW.register("game-quiz", function (ctx, stage, cfg) {
  var Q = cfg.questions || [], qi = 0, score = 0;
  function render() {
    if (qi >= Q.length) {
      var verdict = score === Q.length ? (cfg.perfect || "إنتي حافظاني صم ♡") : score >= Math.ceil(Q.length / 2) ? (cfg.good || "مسموحة المرة دي 😌") : (cfg.bad || "محتاجين نقعد نتكلم 😂");
      stage.innerHTML = '<div class="wow-quiz-end"><b>' + ctx.ar(score) + "/" + ctx.ar(Q.length) + "</b><p>" + ctx.esc(verdict) + "</p></div>";
      ctx.win({ score: ctx.ar(score), total: ctx.ar(Q.length) });
      return;
    }
    var it = Q[qi];
    stage.innerHTML = '<div class="wow-quiz"><div class="wow-quiz-count">سؤال ' + ctx.ar(qi + 1) + " من " + ctx.ar(Q.length) + '</div><div class="wow-quiz-q">' + ctx.esc(it.q) + '</div><div class="wow-quiz-opts"></div><div class="wow-quiz-react wow-hand" role="status"></div></div>';
    var opts = stage.querySelector(".wow-quiz-opts"), done = false;
    it.options.forEach(function (t, k) {
      var b = ctx.h("button", "", ctx.esc(t)); b.type = "button";
      b.onclick = function () {
        if (done) return; done = true;
        var right = k === it.answer; if (right) score++;
        b.classList.add(right ? "right" : "wrong"); if (!right) opts.children[it.answer].classList.add("right");
        stage.querySelector(".wow-quiz-react").textContent = (it.reactions && it.reactions[k]) || (right ? "صح ♡" : "لأ 😅");
        ctx.vib(right ? 30 : [80, 40, 80]);
        setTimeout(function () { qi++; render(); }, 1900);
      };
      opts.appendChild(b);
    });
  }
  render();
});
