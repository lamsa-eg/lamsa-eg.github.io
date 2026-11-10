/* game: date wheel — spin; the result is sent to the sender */
LAMSA_WOW.register("game-wheel", function (ctx, stage, cfg) {
  var opts = cfg.options || [], cols = cfg.colors || ["#F2477E", "#E8C27E", "#3A0B24", "#FF9BBB", "#D92E66", "#FFE4EC"];
  var seg = 360 / opts.length, g = [];
  opts.forEach(function (_, i) { g.push(cols[i % cols.length] + " " + i * seg + "deg " + (i + 1) * seg + "deg"); });
  stage.innerHTML = '<div class="wow-wheel-wrap"><div class="wow-wheel-pin"></div><div class="wow-wheel"></div><button class="wow-wheel-hub" type="button">لفّي</button></div><div class="wow-wheel-res" role="status"></div>';
  var wheel = stage.querySelector(".wow-wheel"), hub = stage.querySelector(".wow-wheel-hub"), res = stage.querySelector(".wow-wheel-res");
  wheel.style.background = "conic-gradient(" + g.join(",") + ")";
  opts.forEach(function (o, i) {
    var s = ctx.h("span", "", ctx.esc(o));
    var dark = /^#3A0B24$/i.test(cols[i % cols.length]);
    s.style.cssText = "position:absolute;left:50%;top:50%;transform-origin:0 0;transform:rotate(" + (i * seg + seg / 2 - 90) + "deg) translate(36px,-9px);font:700 13px var(--wow-body);white-space:nowrap;color:" + (dark ? "#E8C27E" : "#3A0B24");
    wheel.appendChild(s);
  });
  var rot = 0, spun = false;
  hub.onclick = function () {
    if (spun) return; spun = true;
    var k = Math.floor(Math.random() * opts.length);
    rot = 360 * 6 + (360 - (k * seg + seg / 2));
    wheel.style.transform = "rotate(" + rot + "deg)"; ctx.vib(20);
    setTimeout(function () { res.textContent = "طلعت: " + opts[k] + " 🎉"; ctx.win({ result: opts[k] }); }, ctx.reduce ? 50 : 4100);
  };
});
