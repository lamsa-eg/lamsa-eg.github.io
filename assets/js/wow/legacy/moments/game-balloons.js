/* game: pop the balloons — each hides a line; the last one holds the surprise (the reward) */
LAMSA_WOW.register("game-balloons", function (ctx, stage, cfg) {
  var lines = cfg.lines || [], cols = ["#F2477E", "#E8C27E", "#D92E66", "#FF9BBB", "#8b5cf6", "#5AA9FF"];
  var field = ctx.h("div", "wow-balloons"), out = ctx.h("div", "wow-balloon-lines wow-hand");
  out.setAttribute("aria-live", "polite");
  stage.appendChild(field); stage.appendChild(out);
  var left = lines.length;
  lines.forEach(function (l, i) {
    var b = ctx.h("button", "wow-balloon"); b.type = "button"; b.setAttribute("aria-label", "بلونة " + ctx.ar(i + 1));
    b.style.setProperty("--c", cols[i % cols.length]); b.style.setProperty("--d", (i * 0.37) % 2 + "s");
    var pos = [[8, 8], [60, 4], [34, 26], [74, 36], [12, 50], [50, 56], [80, 10], [28, 70]][i % 8];
    b.style.left = pos[0] + "%"; b.style.top = pos[1] + "%";
    b.onclick = function () {
      if (b.classList.contains("pop")) return;
      b.classList.add("pop"); ctx.vib([20, 20, 40]); ctx.confetti(30, [cols[i % cols.length], "#fff"]);
      var d = ctx.h("div", "", ctx.esc(l)); out.appendChild(d);
      left--; if (left === 0) { setTimeout(function () { field.classList.add("done"); }, 400); ctx.win(); }
    };
    field.appendChild(b);
  });
});
