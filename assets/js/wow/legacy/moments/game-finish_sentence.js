/* game: finish_sentence / «خمّن إجابتي» — one or more real questions with the
   buyer's correct answer and wrong options, plus a message after each answer. */
LAMSA_WOW.register("game-finish_sentence",function(ctx,stage,cfg){
  var Q=(cfg.questions&&cfg.questions.length?cfg.questions:(cfg.prompt&&cfg.options&&cfg.options.length>1?[{q:cfg.prompt,options:cfg.options,answer:Number(cfg.answer||0)}]:[])).slice(0,5);
  if(!Q.length){stage.innerHTML="";return}
  var qi=0,score=0;
  function render(){
    if(qi>=Q.length){stage.innerHTML='<div class="wow-quiz-end"><b>'+ctx.ar(score)+"/"+ctx.ar(Q.length)+"</b><p>"+(score===Q.length?"عارفني صم ♡":"قريب أوي 😌")+"</p></div>";ctx.win({score:ctx.ar(score),total:ctx.ar(Q.length)});return}
    var it=Q[qi],done=false;
    stage.innerHTML='<div class="wow-quiz"><div class="wow-quiz-count">سؤال '+ctx.ar(qi+1)+" من "+ctx.ar(Q.length)+'</div><p class="wow-quiz-q">'+ctx.esc(it.q)+'</p><div class="wow-choice-list"></div><div class="wow-quiz-react wow-hand" role="status"></div></div>';
    var list=stage.querySelector(".wow-choice-list");
    (it.options||[]).slice(0,4).forEach(function(t,k){var b=ctx.h("button","",ctx.esc(t));b.type="button";b.onclick=function(){if(done)return;done=true;var right=k===Number(it.answer);if(right)score++;else ctx.fail();b.classList.add(right?"right":"wrong");if(!right&&list.children[it.answer])list.children[it.answer].classList.add("right");stage.querySelector(".wow-quiz-react").textContent=(right?"صح ♡ ":"الإجابة الصح متعلّمة ♡ ")+(it.message||"");setTimeout(function(){qi++;render()},it.message?2600:1700)};list.appendChild(b)});
  }
  render();
});
