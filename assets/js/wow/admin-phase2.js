import{qs,toast,escapeHtml}from"../common-cf-v4.js";
import{requireAdmin,functionPost}from"../client-cf-v4.js";

const memoryId=qs("id");let ctx=null,config=null;
function clean(v,max){return String(v||"").trim().slice(0,max)}
function value(id){return document.getElementById(id)?.value||""}

function panel(){
  const first=document.querySelector(".editor .card.panel .editor-section");if(!first)return null;
  const section=document.createElement("section");section.className="wow-admin-gender";section.id="wowPhase2Admin";
  section.innerHTML=`<span class="kicker">WOW · PHASE 2</span><h3>كشف نوع المولود المتزامن</h3><p class="muted small">النتيجة تظل محفوظة في الجزء الآمن، ولا تصل للزائر قبل انتهاء العد التنازلي.</p>
    <label class="wow-check"><input id="wowGenderEnabled" type="checkbox"> تفعيل لحظة الكشف في صفحة الذكرى</label>
    <div class="wow-admin-choice"><label><input type="radio" name="wowGenderResult" value="girl"> 🎀 بنوتة</label><label><input type="radio" name="wowGenderResult" value="boy"> 💙 ولد</label></div>
    <div class="grid2"><label class="field full">عنوان اللحظة<input id="wowGenderTitle" maxlength="140" placeholder="يا ترى مين جاي ينور حياتنا؟"></label><label class="field full">النص قبل الكشف<textarea id="wowGenderSubtitle" maxlength="320" rows="2" placeholder="استنوا بعض… المفاجأة هتظهر في نفس اللحظة."></textarea></label><label class="field">رسالة البنوتة<input id="wowGenderGirl" maxlength="300" placeholder="نورتِ الحكاية يا أجمل هدية"></label><label class="field">رسالة الولد<input id="wowGenderBoy" maxlength="300" placeholder="نورت الحكاية يا أجمل هدية"></label></div>
    <button class="romantic-btn light" id="wowGenderSave" type="button">حفظ المرحلة الثانية</button><small id="wowGenderAdminState" style="display:block;margin-top:9px" class="muted"></small>`;
  first.insertAdjacentElement("afterend",section);return section;
}

function fill(){
  const moment=(config?.moments||[]).find(x=>x.type==="gender_reveal"),c=moment?.config||{};
  document.getElementById("wowGenderEnabled").checked=!!moment?.enabled;
  const selected=config?.genderReveal?.result;if(selected)document.querySelector(`input[name="wowGenderResult"][value="${escapeHtml(selected)}"]`)?.click();
  document.getElementById("wowGenderTitle").value=c.title||"";document.getElementById("wowGenderSubtitle").value=c.subtitle||"";document.getElementById("wowGenderGirl").value=c.girlMessage||"";document.getElementById("wowGenderBoy").value=c.boyMessage||"";
  const state=document.getElementById("wowGenderAdminState");if(config?.genderReveal?.revealAt)state.textContent=`بدأ الكشف: ${new Date(config.genderReveal.revealAt).toLocaleString("ar-EG")}`;else state.textContent=config?.genderReveal?.configured?"النتيجة محفوظة بأمان — لم يبدأ الكشف بعد.":"اختر النتيجة ثم احفظ.";
}

async function save(){
  const enabled=document.getElementById("wowGenderEnabled").checked,result=document.querySelector('input[name="wowGenderResult"]:checked')?.value||"";
  if(enabled&&!result){toast("اختر بنوتة أو ولد أولًا");return}
  const btn=document.getElementById("wowGenderSave");btn.disabled=true;
  try{
    const moments=[...(config?.moments||[])].filter(x=>x.type!=="gender_reveal");
    if(enabled)moments.push({type:"gender_reveal",enabled:true,sortOrder:Math.max(100,...moments.map(x=>Number(x.sortOrder||0)+10)),config:{anchor:"after_cover",title:clean(value("wowGenderTitle"),140),subtitle:clean(value("wowGenderSubtitle"),320),girlMessage:clean(value("wowGenderGirl"),300),boyMessage:clean(value("wowGenderBoy"),300)}});
    const gates=config?.wow?.gates||{},gateOn=!!(gates.wax_seal?.enabled||gates.locked?.enabled||gates.secret_question?.enabled);
    config=await functionPost("wow-admin-config",{action:"save",memoryId,enabled:enabled||moments.length>0||gateOn,pack:enabled?"wow_baby":config?.wow?.pack,theme:enabled?"theme-baby":config?.wow?.theme,gates,moments,genderReveal:enabled?{result}:undefined},ctx.session.access_token);
    fill();toast("تم حفظ كشف نوع المولود بأمان");document.getElementById("frame").src=`../memory.html?preview=${encodeURIComponent(memoryId)}&t=${Date.now()}`;
  }catch(e){toast(e.message||"تعذر حفظ المرحلة الثانية")}finally{btn.disabled=false}
}

export async function mountGenderAdmin(){
  if(!memoryId)return;const root=panel();if(!root)return;ctx=await requireAdmin();if(!ctx){root.remove();return}
  try{config=await functionPost("wow-admin-config",{action:"get",memoryId},ctx.session.access_token);fill();document.getElementById("wowGenderSave").onclick=save}catch(e){root.querySelector("#wowGenderAdminState").textContent=e.message||"تعذر تحميل إعدادات المرحلة الثانية"}
}

mountGenderAdmin();
