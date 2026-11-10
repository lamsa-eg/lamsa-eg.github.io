# LAMSA — تقرير الفحص (المرحلة الأولى)

تاريخ الفحص: 2026-11-10 · النسخة المفحوصة: `cf-v37-premium-journey` (ملف ZIP المرفوع، 171 ملفًا، 3.8MB)

## 1. البنية الحالية

| الجزء | الملفات | الملاحظة |
|---|---|---|
| موقع ثابت (Static) | `index.html`, `order-v19.html`, `memory.html`, `track.html`, `order-success.html`, `privacy.html`, `terms.html`, `404.html` | بدون Build — HTML/CSS/JS ES Modules مباشرة |
| Cloudflare Pages Worker | `_worker.js`, `_routes.json`, `_headers`, `_redirects` | بوابة `/api/*` → Supabase Edge Functions، `/upload/*` → Signed Upload، `/m/*` → صفحة الذكرى |
| الواجهة | `assets/js/*-cf-v*.js`, `assets/js/wow/**` | محرك WOW + 21 لعبة (legacy modules) + 11 لحظة (moments) |
| الإدارة | `admin/*.html` + `admin-*.js` | Supabase Auth + جدول `admin_profiles` + RLS |
| Supabase | `supabase/functions/*` (17 دالة) + 4 migrations | الـ migrations تخص WOW فقط؛ الجداول الأساسية (`orders`, `memories`, `packages`, `shipping_zones`, `order_uploads`, `memory_media`, `admin_profiles`, `nfc_tags`, `order_events`, `consume_rate_limit`) موجودة على المشروع الحي ولا يوجد لها SQL في الملف |

دوال Edge مستخدمة من الواجهة لكنها **غير موجودة في الـ ZIP** (موجودة على Supabase فقط): `complete-order`, `abort-order`, `track-order`, `claim-owner`, `admin-notifications`, `admin-update-order`, `order-notify-admin`, `attach-special-media`.
لم أتمكن من فحص قاعدة البيانات الحية: حساب Supabase المتصل بهذه الجلسة لا يحتوي على مشروع LAMSA (`qwavanugzcjevhtzjfuo`). لذلك استنتجت الـ schema من الكود.

## 2. ما يعمل

- رحلة الطلب الحالية (`order-v19.html`) مكتملة وظيفيًا: إنشاء طلب idempotent (`requestId`)، Signed Upload عبر الـ Worker، ضغط الصور قبل الرفع، تنظيف الطلب عند الفشل (`abort-order`)، رقم متابعة.
- الأسعار وحدود الباقات ومناطق الشحن تُقرأ من `packages`/`shipping_zones` عبر `/api/public-config`، ويُعاد حساب السعر على السيرفر.
- صفحة الذكرى: Hero، رسالة، معرض، صوت، فيديو، أغنية (YouTube/TikTok/MP3)، موسيقى، مشاركة، تقدم القراءة، وضع demo.
- محرك WOW: بوابات (ختم شمع، قفل بموعد، سؤال سري)، مكافآت مقفولة على السيرفر وتظهر بعد الفوز فقط، rate limit، أحداث الألعاب.
- RLS مفعّل على جداول WOW، وسياسات المسؤول مبنية على `admin_profiles`.
- لوحة الإدارة: قائمة الطلبات، تفاصيل الطلب، سحب الملفات للذكرى، النشر، QR، كتابة NFC، محرر الذكرى والألعاب، مناطق الشحن، إشعارات.
- لا أخطاء JavaScript في Console على أي صفحة، ولا تمرير أفقي في المقاسات الستة (360→1920).

## 3. موجود لكنه غير مكتمل

1. **الألعاب لا تستخدم إجابات حقيقية فعلًا**: استبيان القصة (8 أسئلة عامة) يولّد إعدادات ضعيفة. مثلًا «مين فينا؟» سؤال واحد باختيارات ثابتة «أنا/إنت/الاتنين» وإجابة صحيحة دائمًا الأولى؛ «رتّب الحكاية» بلا صور أو أحداث (تظهر أرقام فقط)؛ «كمّل الجملة» و«صح ولا غلط» و«افتح لما…» بلا بيانات تُرسل من الطلب.
2. **محتوى تجريبي يظهر للمستلم الحقيقي**: وحدات `open_when` و`true_false` و`finish_sentence` تعرض نصوصًا افتراضية ثابتة عندما لا توجد بيانات.
3. صفحة الطلب صفحة واحدة طويلة جدًا (حوالي 9,500px على الموبايل)، بلا خطوات أو حفظ مسودة. يضيع كل شيء عند Refresh، ولا توجد معاينة أو إعادة ترتيب للصور.
4. لا توجد إدارة للأسعار والباقات والألعاب من لوحة الإدارة. الأسعار تُعدل من SQL فقط (migration v35 فيه `update packages set price=...`).
5. لا يوجد سجل تدقيق (Audit Log) للتعديلات الإدارية المهمة.
6. لا توجد صفحة 404 تعمل على المسارات الفرعية (تستخدم مسارات CSS نسبية).

## 4. أخطاء فعلية

| # | الخطورة | المشكلة | المكان |
|---|---|---|---|
| B1 | **حرجة (أمان)** | سر البوابة بين الـ Worker والـ Edge Functions مكتوب داخل الكود (`BUNDLED_WOW_GATEWAY_SECRET`) ومكرر في `_shared/wow.ts`. أي شخص معه الـ ZIP يستطيع استدعاء الدوال المحمية مباشرة. **يجب تغيير هذا السر (Rotate) فورًا.** | `_worker.js`, `supabase/functions/_shared/wow.ts` |
| B2 | عالية | أسعار مكتوبة يدويًا في أكثر من مكان ومتعارضة: الصفحة الرئيسية 299/449/699، الـ migration 299/499/799، `common-cf-v4.js` 299/449/699، الإضافات 149/49/99 داخل `story-builder-v35.js`. عند فشل تحميل الكتالوج يرى العميل سعرًا خاطئًا. | `index.html`, `order-v19.html`, `common-cf-v4.js`, `story-builder-v35.js` |
| B3 | عالية | ألعاب تُعرض للمستلم بمحتوى وهمي (انظر 3.2)، وألعاب الصور تُختار من «الصورة 1/2/3» حتى لو لم يرفع العميل صورًا كافية. | `legacy/moments/*.js`, `story-builder-v35.js` |
| B4 | متوسطة | وسم «الأكثر اختيارًا» على باقة Memory ادعاء غير مدعوم ببيانات حقيقية. | `index.html` |
| B5 | متوسطة | صورة المشاركة `lamsa-pink-hero.png` في صفحة الذكرى غير موجودة (معاينة واتساب مكسورة). | `memory.html` |
| B6 | متوسطة | أقسام الصفحة الرئيسية مخفية (`opacity:0`) حتى يعمل IntersectionObserver. إذا تأخر JavaScript أو فشل يختفي المحتوى، وهذا يضر الفهرسة. | `home-v37.css`, `common-cf-v4.js` |
| B7 | منخفضة | `Cache-Control: no-store` على كل ملفات `/assets/js/*`، فيعيد الموبايل تحميل JavaScript في كل زيارة. | `_headers` |
| B8 | منخفضة | `manifest.webmanifest` مخصص للإدارة (`start_url=/admin/dashboard.html`) ومربوط بالموقع العام. | `manifest.webmanifest` |
| B9 | منخفضة | `sitemap.xml` يحتوي `/order` الذي يعيد التوجيه 302، ولا يحتوي `lastmod`. | `sitemap.xml` |
| B10 | منخفضة | `order-wow-selection` يمرر إعدادات الألعاب غير المعروفة كما هي (`...c`) دون تنظيف الحقول. | Edge Function |

## 5. ملفات متكررة أو قديمة

- `order.html` مجرد تحويل إلى `order-v19.html`، و`_redirects` يحوّل `/order` و`order-v13..18` إلى `order-v19.html`.
- `home-catalog-v18.js` غير مستخدم (`home-v37.js` يكرر نفس المنطق).
- `assets/css/order-games-v34.css` و`wow-games-v35/36.css` طبقات فوق بعضها.
- ملفات توثيق إصدارات قديمة: `V34_UPLOAD_INSTRUCTIONS.txt`, `V35_*`, `WOW_PHASE*`, `MERGE_NOTES.md`، وكلها ضمن ملف النشر (تُنشر للعامة).
- `supabase/` و`tests/` و`*.md` تُرفع داخل ZIP النشر. المجلد `supabase/` يحتوي السر المذكور في B1.

## 6. خطة التنفيذ

| المرحلة | المحتوى |
|---|---|
| 2. Foundation | إزالة السر من الكود (متغيرات بيئة)، توحيد الكتالوج (مصدر واحد للأسعار)، Design System، إصلاح headers/404/manifest/OG، سكربت Build ينتج `dist/` نظيفًا |
| 3. واجهة البيع | إعادة بناء الصفحة الرئيسية: Hero، خمس خطوات، تجارب WOW قابلة للعب فعلًا، الألعاب من الإجابات، الهدية الملموسة، الباقات من القاعدة، الثقة، FAQ، SEO |
| 4. رحلة الطلب | Wizard من 12 خطوة، مسودة تلقائية (localStorage + IndexedDB للصور)، ترتيب/حذف الصور، Registry موحد للألعاب مع محررات إجابات حقيقية، مراجعة، إرسال مرة واحدة، دعم زر الرجوع وضعف الشبكة |
| 5. تجربة الذكرى | إخفاء الألعاب بلا بيانات، ترقية «رتّب ذكرياتنا» و«افتحها عندما…» و«خمّن إجابتي»، تعليقات بعد الإجابة، OG صحيح |
| 6. الإدارة | صفحة الكتالوج (باقات/أسعار/إضافات/مواسم/ألعاب) + سجل تدقيق، migration إضافي آمن |
| 7. الجودة والنشر | اختبارات E2E كاملة بخادم Mock، لقطات للمقاسات الستة، مراجعة أمان، `DEPLOYMENT.md` وZIP نهائي |

قرار مهم: لن أغيّر عقد الـ API الحالي (`create-order` → رفع → `complete-order` → `order-wow-selection`)، حتى تعمل الواجهة الجديدة مع الدوال المنشورة حاليًا قبل نشر أي تحديث للدوال.
