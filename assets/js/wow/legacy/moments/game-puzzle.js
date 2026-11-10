/* game: puzzle — tap two tiles to swap; wrong-looking long sessions reveal the skip button via core timer */
LAMSA_WOW.register("game-puzzle", function (ctx, stage, cfg) {
  var n = cfg.size || 3, N = n * n, order = [], sel = -1, moves = 0, solved = false;
  for (var i = 0; i < N; i++) order.push(i);
  do { for (var i2 = N - 1; i2 > 0; i2--) { var j = Math.floor(Math.random() * (i2 + 1)); var t = order[i2]; order[i2] = order[j]; order[j] = t; } }
  while (order.every(function (v, k) { return v === k; }));
  var grid = ctx.h("div", "wow-pz"); grid.style.gridTemplateColumns = "repeat(" + n + ",1fr)";
  var meta = ctx.h("div", "wow-pz-meta", "");
  stage.appendChild(grid); stage.appendChild(meta);
  var step = 100 / (n - 1);
  function draw() {
    grid.innerHTML = "";
    order.forEach(function (v, i) {
      var b = ctx.h("button", i === sel ? "sel" : ""); b.type = "button";
      b.style.backgroundImage = "url(" + cfg.image + ")"; b.style.backgroundSize = n * 100 + "% " + n * 100 + "%";
      b.style.backgroundPosition = (v % n) * step + "% " + Math.floor(v / n) * step + "%";
      b.setAttribute("aria-label", "حتة " + ctx.ar(i + 1));
      b.onclick = function () {
        if (solved) return;
        if (sel < 0) { sel = i; ctx.vib(10); draw(); return; }
        if (sel !== i) { var t = order[sel]; order[sel] = order[i]; order[i] = t; moves++; ctx.vib(15); }
        sel = -1; draw(); check();
      };
      grid.appendChild(b);
    });
    meta.textContent = moves ? "عدد الحركات: " + ctx.ar(moves) : "دوسي على حتتين عشان يبدلوا مكانهم";
  }
  function check() {
    if (!order.every(function (v, k) { return v === k; })) { if (moves && moves % 15 === 0) ctx.fail(); return; }
    solved = true; grid.classList.add("solved"); meta.textContent = "اتحلت في " + ctx.ar(moves) + " حركة ✓";
    ctx.win({ moves: ctx.ar(moves) });
  }
  draw();
});
