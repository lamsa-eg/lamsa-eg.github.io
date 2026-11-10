/* game: order_story (رتّب ذكرياتنا) — real events from the order wizard (v38),
   or photos (older orders). Tap two tiles to swap them. */
LAMSA_WOW.register("game-order_story",function(ctx,stage,cfg){
  var events=(cfg.events&&cfg.events.length?cfg.events:(cfg.photos||cfg.images||[]).map(function(src){return{image:src}})).slice(0,6);
  if(events.length<2){stage.innerHTML="";return}
  var correct=cfg.correctOrder&&cfg.correctOrder.length===events.length?cfg.correctOrder:events.map(function(_,i){return i});
  var order=events.map(function(_,i){return i}),tries=0;
  do{order.sort(function(){return Math.random()-.5});tries++}while(tries<8&&order.every(function(x,k){return x===correct[k]}));
  var picked=-1;
  function tile(v,i){
    var e=events[v]||{},b=ctx.h("button","wow-story-photo"+(e.title?" has-text":""));b.type="button";
    b.setAttribute("aria-label","المكان "+ctx.ar(i+1)+(e.title?": "+e.title:""));
    b.innerHTML=(e.image?'<img src="'+ctx.esc(e.image)+'" alt="" loading="lazy">':"")+(e.title?'<span class="wow-story-cap"><b>'+ctx.esc(e.title)+'</b>'+(e.when?"<small>"+ctx.esc(e.when)+"</small>":"")+"</span>":(e.image?"":"<b>"+ctx.ar(v+1)+"</b>"))+'<i class="wow-story-no">'+ctx.ar(i+1)+"</i>";
    b.onclick=function(){if(picked<0){picked=i;b.classList.add("picked");return}var t=order[picked];order[picked]=order[i];order[i]=t;picked=-1;draw();if(order.every(function(x,k){return x===correct[k]}))ctx.win({moves:"✓"});};
    return b;
  }
  function draw(){stage.innerHTML='<p class="wow-game-tip">رتّب الأحداث من أول الحكاية — اضغط على حدثين عشان يبدّلوا مكانهم</p><div class="wow-story-order'+(events.some(function(e){return e.title})?" is-events":"")+'"></div><button type="button" class="wow-story-check">تأكيد الترتيب</button>';var box=stage.querySelector(".wow-story-order");order.forEach(function(v,i){box.appendChild(tile(v,i))});stage.querySelector(".wow-story-check").onclick=function(){if(order.every(function(x,k){return x===correct[k]}))ctx.win({moves:"✓"});else{ctx.fail();ctx.toast&&ctx.toast("لسه في ترتيب مش مظبوط — جرّب تاني ♡")}}}
  draw();
});
