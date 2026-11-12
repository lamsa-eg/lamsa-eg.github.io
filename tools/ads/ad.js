// Fills the ad template from the query string. Names in mock games are fictional (same as the site demo).
const q = new URLSearchParams(location.search), c = q.get("c") || "hero", price = q.get("price") || "";
const W = innerWidth, H = innerHeight, fmt = W > H ? "wide" : H / W > 1.6 ? "story" : H === W ? "sq" : "port";
const img = (src, cls = "arch") => `<div class="${cls}"><img src="${src}" alt=""></div>`;
const C = {
  hero: { bg: "night", chip: "هدية تتلمس · NFC + QR", h: ["مش صفحة صور…", "دي رحلة من قصتكم."], sub: "صوركم ورسايلكم وأغنيتكم، وألعاب من إجاباتكم الحقيقية.", vis: img("/assets/img/scene-gift.svg") },
  game: { bg: "sand", chip: "ألعاب من تفاصيلكم", h: ["هدية بتسألكم:", "مين اللي بيتأخر أكتر؟"], sub: "إنتو اللي بتكتبوا الأسئلة والإجابات — مش أسئلة جاهزة.",
    vis: `<div class="phone"><small>✦ لعبة «مين فينا؟»</small><div class="q">مين اللي بيتأخر أكتر؟</div><div class="o"><span>آدم</span><span class="y">ليلى ✓</span></div><div class="r">«ربع ساعة بالظبط» ♡</div></div>` },
  tap: { bg: "sand", chip: "من غير أي تطبيق", h: ["قرّب الموبايل…", "والحكاية تفتح."], sub: "هدية في إيدك، وذكرى كاملة بتفتح بلمسة NFC أو QR.", vis: img("/assets/img/scene-tap.svg", "round") },
  steps: { bg: "night", chip: "بتتعمل مخصوص ليكم", h: ["هدية من قصتكم", "في ٣ خطوات"], sub: "",
    vis: `<div class="steps"><div class="step"><i>١</i><div><b>احكوا قصتكم</b><span>صور، رسالة، أغنية وإجابات الألعاب</span></div></div><div class="step"><i>٢</i><div><b>إحنا نجهّزها</b><span>هدية تتلمس + صفحة ذكرى خاصة</span></div></div><div class="step"><i>٣</i><div><b>تفتح بلمسة</b><span>NFC أو QR من أي موبايل</span></div></div></div>` },
  birthday: { bg: "sun", chip: "هدية عيد ميلاد مختلفة", h: ["عيد ميلاد حد غالي قرّب؟", "اهديه ذكرى تتفتح بلمسة."], sub: "صوركم سوا، رسالتك بصوتك، وألعاب عن تفاصيلكم.", vis: img("/assets/demo-v2/birthday.svg") },
  anniversary: { bg: "night", chip: "لذكرى أول لقاء", h: ["فاكرين أول قهوة؟", "خلّوا الذكرى تتلمس."], sub: "هدية بتحكي حكايتكم من أول يوم — بصوركم وكلامكم.", vis: img("/assets/demo-v2/coffee.svg") },
  privacy: { bg: "night", chip: "خصوصيتكم أولًا", h: ["اللحظة تخصكم،", "وتفضل بينكم."], sub: "",
    vis: `<div class="steps"><div class="step"><i>✦</i><div><b>صوركم مش للإعلانات</b><span>مش بنستخدم صوركم أو قصتكم في أي محتوى عام</span></div></div><div class="step"><i>✦</i><div><b>رابط خاص بيكم</b><span>طويل ومش بيظهر في محركات البحث</span></div></div><div class="step"><i>✦</i><div><b>تقدروا تقفلوها برمز</b><span>سؤال سري أو ميعاد فتح محدد</span></div></div></div>` },
  welcome: { bg: "sun", chip: "أهلًا بيكم", h: ["هدية تتلمس،", "وذكرى تفتح بلمسة."], sub: "صوركم ورسايلكم وأغنيتكم، وألعاب من إجاباتكم الحقيقية.", vis: img("/assets/img/scene-gift.svg") }
}[c];
document.body.className = `${C.bg} ${fmt}`;
const head = `<div class="brand"><b><i>✦</i>لمسة</b><span class="chip">${C.chip}</span></div>`;
const text = `<h1>${C.h[0]}<span>${C.h[1]}</span></h1>${C.sub ? `<p class="sub">${C.sub}</p>` : ""}`;
const foot = `<div class="foot"><span class="cta">ابدأ حكايتكم ←</span>${price ? `<span class="price">تبدأ من<b>${price} ج.م</b></span>` : `<span class="url">lamsa-eg.github.io</span>`}</div>`;
document.body.innerHTML = `<div class="stars"></div>${head}` + (fmt === "wide" ? `<div class="txt">${text}</div><div class="vis">${C.vis}</div>` : `${text}<div class="vis">${C.vis}</div>`) + foot;
