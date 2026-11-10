/* game: catch the hearts — tap falling hearts before time runs out. Golden heart = +3 */
LAMSA_WOW.register("game-hearts", function (ctx, stage, cfg) {
  var target = cfg.target || 15, secs = cfg.seconds || 25;
  stage.innerHTML = '<div class="wow-hearts"><div class="wow-hearts-hud"><span class="sc">٠/' + ctx.ar(target) + '</span><span class="tm">' + ctx.ar(secs) + 'ث</span></div><div class="wow-hearts-field"><button class="wow-btn wow-btn-rose wow-hearts-start" type="button">ابدئي ♡</button></div></div>';
  var field = stage.querySelector(".wow-hearts-field"), scEl = stage.querySelector(".sc"), tmEl = stage.querySelector(".tm");
  var running = false, score = 0, left = secs, raf = 0, clock = 0, spawnT = 0, items = [];
  function start() {
    field.innerHTML = ""; running = true; score = 0; left = secs; items = [];
    scEl.textContent = "٠/" + ctx.ar(target); tmEl.textContent = ctx.ar(left) + "ث";
    clock = setInterval(function () { left--; tmEl.textContent = ctx.ar(left) + "ث"; if (left <= 0) end(false); }, 1000);
    spawn(); loop();
  }
  function spawn() {
    if (!running) return;
    var gold = Math.random() < 0.12, b = document.createElement("button");
    b.type = "button"; b.className = "wow-heart" + (gold ? " gold" : ""); b.textContent = gold ? "💛" : Math.random() < 0.5 ? "💗" : "❤️";
    b.setAttribute("aria-label", "قلب");
    var w = field.clientWidth, x = Math.random() * (w - 50);
    var it = { el: b, y: -50, v: 1.3 + Math.random() * 1.8 + (secs - left) * 0.05, gold: gold };
    b.style.left = x + "px"; b.style.transform = "translateY(-50px)";
    b.addEventListener("pointerdown", function (e) {
      e.preventDefault(); if (!running || it.hit) return; it.hit = true;
      score += gold ? 3 : 1; scEl.textContent = ctx.ar(Math.min(score, target)) + "/" + ctx.ar(target);
      b.classList.add("hit"); ctx.vib(gold ? [20, 20, 40] : 15);
      setTimeout(function () { b.remove(); }, 250);
      if (score >= target) end(true);
    });
    field.appendChild(b); items.push(it);
    spawnT = setTimeout(spawn, 380 + Math.random() * 380);
  }
  function loop() {
    var hgt = field.clientHeight;
    items.forEach(function (it) { if (it.hit) return; it.y += it.v; it.el.style.transform = "translateY(" + it.y + "px)"; if (it.y > hgt) { it.hit = true; it.el.remove(); } });
    items = items.filter(function (it) { return !it.hit || it.el.isConnected; });
    if (running) raf = requestAnimationFrame(loop);
  }
  function end(win) {
    running = false; clearInterval(clock); clearTimeout(spawnT); cancelAnimationFrame(raf);
    field.innerHTML = "";
    if (win) { field.innerHTML = '<div class="wow-hearts-msg">اصطادتي ' + ctx.ar(target) + " قلب ♡</div>"; ctx.win({ left: ctx.ar(left) }); }
    else {
      field.innerHTML = '<div class="wow-hearts-msg">قربتي! ' + ctx.ar(score) + " من " + ctx.ar(target) + '</div><button class="wow-btn wow-btn-rose wow-hearts-start" type="button">حاولي تاني</button>';
      field.querySelector("button").onclick = start; ctx.fail();
    }
  }
  field.querySelector("button").onclick = start;
});
