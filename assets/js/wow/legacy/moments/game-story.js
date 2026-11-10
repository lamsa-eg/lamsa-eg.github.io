/* game: choose-your-story — branching nodes; reaching any ending counts as a win */
LAMSA_WOW.register("game-story", function (ctx, stage, cfg) {
  var nodes = cfg.nodes || {}, path = [];
  function go(id) {
    var n = nodes[id]; if (!n) return;
    path.push(id);
    stage.innerHTML = '<div class="wow-story"><p class="wow-story-text wow-hand">' + ctx.esc(n.text) + '</p><div class="wow-story-choices"></div></div>';
    var box = stage.querySelector(".wow-story-choices");
    if (n.end) {
      var again = ctx.h("button", "wow-link", "جرّبي طريق تاني"); again.type = "button";
      again.onclick = function () { path = []; go(cfg.start); };
      box.appendChild(again);
      ctx.win({ ending: n.title || "" });
      return;
    }
    (n.choices || []).forEach(function (c) {
      var b = ctx.h("button", "wow-story-choice", ctx.esc(c.label)); b.type = "button";
      b.onclick = function () { ctx.vib(12); go(c.next); };
      box.appendChild(b);
    });
  }
  go(cfg.start);
});
