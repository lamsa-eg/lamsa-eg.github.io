/* game: memory match — flip cards to find pairs of their photos */
LAMSA_WOW.register("game-memory", function (ctx, stage, cfg) {
  var imgs = (cfg.images || []).slice(0, 8), deck = [];
  imgs.forEach(function (src, i) { deck.push({ k: i, src: src }, { k: i, src: src }); });
  for (var i = deck.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
  var grid = ctx.h("div", "wow-mem"), meta = ctx.h("div", "wow-pz-meta", "اقلبي كارتين، ولو شبه بعض يفضلوا مفتوحين");
  grid.style.gridTemplateColumns = "repeat(" + (deck.length > 12 ? 4 : 4) + ",1fr)";
  stage.appendChild(grid); stage.appendChild(meta);
  var open = [], matched = 0, moves = 0, busy = false;
  deck.forEach(function (c, idx) {
    var b = ctx.h("button", "wow-mem-card", '<span class="back">♡</span><span class="front" style="background-image:url(' + ctx.esc(c.src) + ')"></span>');
    b.type = "button"; b.setAttribute("aria-label", "كارت " + ctx.ar(idx + 1));
    b.onclick = function () {
      if (busy || b.classList.contains("up")) return;
      b.classList.add("up"); open.push({ b: b, c: c }); ctx.vib(10);
      if (open.length < 2) return;
      moves++; busy = true;
      var a = open[0], z = open[1];
      if (a.c.k === z.c.k) {
        a.b.classList.add("ok"); z.b.classList.add("ok"); matched++; open = []; busy = false; ctx.vib(30);
        meta.textContent = "لقيتي " + ctx.ar(matched) + " من " + ctx.ar(imgs.length);
        if (matched === imgs.length) ctx.win({ moves: ctx.ar(moves) });
      } else {
        setTimeout(function () { a.b.classList.remove("up"); z.b.classList.remove("up"); open = []; busy = false; }, 850);
        if (moves % 10 === 0) ctx.fail();
      }
    };
    grid.appendChild(b);
  });
});
