/* game: open_when (افتحها عندما…) — real letters only. once=true letters can be
   read a single time on this device; others can be reopened any time. */
LAMSA_WOW.register("game-open_when",function(ctx,stage,cfg){
  var items=(cfg.items||[]).filter(function(x){return x&&x.title}).slice(0,6);
  if(!items.length){stage.innerHTML="";return}
  var seen=(ctx.state.get()||{}).letters||{};
  function save(){var s=ctx.state.get()||{};s.letters=seen;ctx.state.set(s)}
  stage.innerHTML='<div class="wow-open-when"></div>';
  var box=stage.firstChild;
  items.forEach(function(x,i){
    var b=ctx.h("button","wow-letter");b.type="button";b.setAttribute("aria-expanded","false");
    function closed(){var used=x.once&&seen[i];b.innerHTML='<b>'+ctx.esc(x.title)+'</b><span>'+(used?"اتفتحت قبل كده ♡":"ظرف مقفول — اضغط عشان تفتحه")+"</span>";b.disabled=!!used;b.setAttribute("aria-expanded","false")}
    function open(){b.innerHTML='<b>'+ctx.esc(x.title)+'</b>'+(x.image?'<img class="wow-letter-img" src="'+ctx.esc(x.image)+'" alt="" loading="lazy">':"")+'<p>'+ctx.esc(x.text||x.message||"")+'</p><span>'+(x.once?"الرسالة دي بتتقري مرة واحدة":"اضغط عشان تقفلها")+"</span>";b.setAttribute("aria-expanded","true")}
    b.onclick=function(){if(b.getAttribute("aria-expanded")==="true"){if(x.once){seen[i]=1;save()}closed();return}open();ctx.event("letter_open",{letter:i}).catch(function(){});ctx.vib&&ctx.vib(20)};
    closed();box.appendChild(b);
  });
});
