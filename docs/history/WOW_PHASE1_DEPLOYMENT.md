# LAMSA WOW ✦ — Phase 1 on V28

هذه النسخة مبنية على **LAMSA V28 TikTok Support**، وليست V29/V30. WOW إضافة فقط.

## ما تم تنفيذه في Phase 1
- Core engine + lazy loading + feature flag عبر Cloudflare env `WOW_ENABLED`.
- Gates: `wax_seal`, `locked`, `secret_question`.
- Moments: `live_counter`, `typewriter_letter`, `first_chat`, `open_notify`, `reply`, `mirror`.
- `public-memory` لا يرجع `wow` أصلًا للذكريات العادية.
- أي ذكرى بلا WOW تستخدم نفس DOM/CSS/rendering الخاص بـ V28 ولا تحمل `wow.css` أو modules.
- `locked` لا يرسل الرسالة/الأغنية/المعرض/إعدادات سؤال السر قبل الموعد.
- سؤال السر: normalization عربي + salted hash + 5 محاولات/15 دقيقة/IP/slug + HMAC unlock token لمدة 12 ساعة في `sessionStorage`.
- الردود: نص <=1000، صوت <=60 ثانية، صورة mirror؛ بحد أقصى 3 ردود؛ storage خاص `wow-replies`.
- mirror لا يرفع أي صورة إلا بعد ضغط «ابعتيها».
- open_notify يسجل أول فتح ويرسل وقت الفتح فقط للمرسل إذا فعّل Web Push من track.html.
- Cache bypass لأي memory عليها gate أو stateful moment.
- Gateway secret مطلوب على وظائف WOW و public-memory.

## ترتيب النشر الآمن
1. أنشئ قيمة عشوائية طويلة لـ `LAMSA_WOW_GATEWAY_SECRET`.
2. ضع نفس القيمة في Cloudflare Pages Environment Variables وفي Supabase Edge Function secrets.
3. اترك `WOW_ENABLED=false` في Cloudflare أولًا. رفع ZIP وحده في هذه الحالة لا يغيّر سلوك V28 الحالي.
4. طبّق `supabase/migrations/20260925_lamsa_wow_phase1.sql`.
5. انشر Edge Functions الموجودة في `supabase/functions/`، مع `verify_jwt=false` للـ public-memory/WOW public endpoints لأنها محمية بالـ gateway داخل الكود، وليس بالـ anon client.
6. ارفع ZIP إلى Cloudflare Pages.
7. أنشئ Cloudflare Turnstile وأضف `TURNSTILE_SITE_KEY` في Cloudflare و`TURNSTILE_SECRET_KEY` في Supabase.
8. بعد الاختبارات غيّر `WOW_ENABLED=true`.

> مهم: قبل نشر `public-memory` الجديد اضبط الـ gateway secret في الناحيتين. الـ Worker نفسه آمن للرفع مبكرًا طالما `WOW_ENABLED=false`.

## خطوط عربية
CSS يستخدم Lalezar / IBM Plex Sans Arabic / Aref Ruqaa إذا كانت متاحة مع fallbacks آمنة. ملفات الخطوط الثنائية غير مضمنة في هذا التسليم؛ أضف نسخ WOFF2 مرخّصة في بيئة النشر لو أردت self-hosting الكامل.
