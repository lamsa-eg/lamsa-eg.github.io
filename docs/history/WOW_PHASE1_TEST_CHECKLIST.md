# LAMSA WOW Phase 1 — Test Checklist

## 1) Non-WOW regression
- افتح ذكرى قديمة بدون `memory_wow` أو `enabled=false`.
- تأكد أن JSON من `/api/public-memory` لا يحتوي مفتاح `wow`.
- Network: لا يجب تحميل `/assets/css/wow.css` ولا أي `/assets/js/wow/*`.
- قارن الواجهة/الموسيقى/TikTok/gallery مع V28؛ يجب أن تكون مطابقة.

## 2) Locked content must not leak
```bash
curl -sS https://YOUR_DOMAIN/api/public-memory \
  -H 'content-type: application/json' \
  --data '{"slug":"m-YOURSLUG"}' | tee /tmp/locked.json

# يجب ألا يظهر أي من الحقول/المحتوى الكامل:
cat /tmp/locked.json | grep -E '"message"|"songUrl"|"intro"|"moments"'
# moments مسموح أن يكون [] فقط؛ message/song/intro يجب ألا تظهر.
```
وتأكد أن `media` يحتوي cover واحد فقط.

## 3) Direct Edge Function bypass must fail
```bash
curl -i https://qwavanugzcjevhtzjfuo.supabase.co/functions/v1/public-memory \
  -H 'content-type: application/json' \
  --data '{"slug":"m-YOURSLUG"}'
# Expected: 403 Gateway required
```

## 4) Secret question
- الإجابة الصحيحة تفتح الذكرى ويُحفظ HMAC token في sessionStorage لمدة 12h.
- 5 إجابات خاطئة خلال 15 دقيقة ثم المحاولة السادسة => 429.
- بعد 3 محاولات يظهر hint فقط.

## 5) Reply + Mirror
- text >1000 مرفوض/مقصوص في العميل والسيرفر يفرض الحد.
- voice >60s لا يُقبل.
- mirror لا يعمل upload قبل «ابعتيها».
- الرد الرابع لنفس الذكرى => 409.
- track.html يعرض replies بروابط signed قصيرة العمر.

## 6) Open notify
- فعّل Web Push من track.html.
- أول فتح ناجح بعد اجتياز gates يسجل `first_opened_at`.
- إشعار المرسل يحتوي الوقت فقط.

## 7) Gender result non-leak proof
Phase 1 لا يحتوي gender reveal أصلًا. لذلك public-memory لا يقرأ أي جدول/حقل gender.
```bash
curl -sS https://YOUR_DOMAIN/api/public-memory -H 'content-type: application/json' --data '{"slug":"m-YOURSLUG"}' | grep -Ei 'gender|boy|girl|blue|pink'
# Expected in Phase 1: no gender-result payload. Full synchronized gender proof is mandatory in Phase 2.
```

## 8) Burned message unrecoverable
`burn_message` من Phase 4 وغير موجود في Phase 1. لا يوجد endpoint أو table يعرض body الآن. اختبار read-once + deletion سيكون blocker في Phase 4 قبل الشحن.

## 9) Reduced motion / device fallbacks
- فعّل Reduce Motion: typewriter يظهر final state، seal لا يعتمد على animation.
- امنع camera/mic: تظهر رسالة ودية وتظل الصفحة قابلة للاستخدام.
