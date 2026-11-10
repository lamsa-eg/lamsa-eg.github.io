function sessionId(slug){
  const key=`lamsa-wow-gender-session:${slug}`;
  let value=sessionStorage.getItem(key)||"";
  if(!/^[A-Za-z0-9_-]{16,96}$/.test(value)){
    const bytes=crypto.getRandomValues(new Uint8Array(18));
    value=btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
    sessionStorage.setItem(key,value);
  }
  return value;
}

export async function mount({memory,moment,core}){
  const c=moment.config||{},root=core.makeMoment("gender_reveal",c);
  root.innerHTML=`<div class="wow-card wow-gender-card" aria-live="polite">
    <div class="wow-gender-orbit" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="wow-kicker">LAMSA WOW ✦ BABY</div>
    <h2>${core.escapeHtml(c.title||"يا ترى مين جاي ينور حياتنا؟")}</h2>
    <p class="wow-gender-sub">${core.escapeHtml(c.subtitle||"استنوا بعض… المفاجأة هتظهر لكل الموجودين في نفس اللحظة.")}</p>
    <div class="wow-gender-stage">
      <div class="wow-gender-wait"><div class="wow-gender-heart">♡</div><b>في انتظار بدء اللحظة</b><span>خلي الصفحة مفتوحة… العد التنازلي هيبدأ هنا.</span></div>
      <div class="wow-gender-count" hidden><small>المفاجأة بعد</small><strong>١٢</strong><span>ثانية</span></div>
      <div class="wow-gender-result" hidden><span class="wow-gender-icon">♡</span><small>المفاجأة الحلوة</small><strong></strong><p></p></div>
    </div>
    <div class="wow-gender-meta"><span class="wow-gender-live"><i></i><b>١</b> موجود الآن</span><button class="wow-link wow-gender-refresh" type="button">تحديث</button></div>
    <p class="wow-gender-error" role="alert"></p>
  </div>`;
  const wait=root.querySelector(".wow-gender-wait"),count=root.querySelector(".wow-gender-count"),result=root.querySelector(".wow-gender-result"),number=count.querySelector("strong"),people=root.querySelector(".wow-gender-live b"),error=root.querySelector(".wow-gender-error"),refresh=root.querySelector(".wow-gender-refresh");
  let stopped=false,timer=0,offset=0,lastState="",revealAt=0;
  const sid=sessionId(memory.slug);
  function show(state){wait.hidden=state!=="waiting";count.hidden=state!=="countdown";result.hidden=state!=="revealed"}
  function reveal(gender){
    if(lastState==="revealed")return;lastState="revealed";show("revealed");
    const girl=gender==="girl",label=girl?(c.girlLabel||"بنوّتة جميلة 🎀"):(c.boyLabel||"ولد جميل 💙"),message=girl?(c.girlMessage||"نورتِ الحكاية قبل ما توصلي يا أجمل هدية"):(c.boyMessage||"نورت الحكاية قبل ما توصل يا أجمل هدية");
    root.dataset.gender=girl?"girl":"boy";result.querySelector("strong").textContent=label;result.querySelector("p").textContent=message;result.querySelector(".wow-gender-icon").textContent=girl?"🎀":"★";
    core.haptic([35,45,35,45,80]);core.confetti({palette:girl?["#ff83b8","#ffd0e4","#fff"]:["#4da9ff","#b9e0ff","#fff"],count:110});
  }
  function tick(){
    if(lastState!=="countdown"||!revealAt)return;
    const left=Math.max(0,Math.ceil((revealAt-(Date.now()+offset))/1000));number.textContent=core.arDigits(left);core.haptic(left<=3&&left>0?12:0);
    if(left<=0){clearInterval(timer);setTimeout(poll,120)}
  }
  async function poll(){
    if(stopped)return;refresh.disabled=true;
    try{
      const d=await core.api("wow-gender-reveal",{action:"status",slug:memory.slug,sessionId:sid});
      error.textContent="";people.textContent=core.arDigits(Math.max(1,Number(d.participants||1)));
      if(d.serverNow)offset=new Date(d.serverNow).getTime()-Date.now();
      if(d.state==="revealed"&&["boy","girl"].includes(d.result)){reveal(d.result);return}
      if(d.state==="countdown"&&d.revealAt){lastState="countdown";show("countdown");revealAt=new Date(d.revealAt).getTime();clearInterval(timer);tick();timer=setInterval(tick,250)}
      else{lastState="waiting";show("waiting");clearInterval(timer)}
    }catch(e){error.textContent=e.message||"تعذر تحديث اللحظة"}
    finally{refresh.disabled=false;if(!stopped&&lastState!=="revealed")setTimeout(poll,lastState==="countdown"?1000:3000)}
  }
  if(memory.wow?.previewBypass===true){refresh.hidden=true;error.textContent="معاينة التصميم — النتيجة الحقيقية لا تظهر داخل محرر الذكرى.";core.observe(root);return}
  refresh.onclick=poll;core.observe(root,poll);
  addEventListener("pagehide",()=>{stopped=true;clearInterval(timer)},{once:true});
}
