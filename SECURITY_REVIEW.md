# مراجعة الأمان والخصوصية — لمسة v38

تاريخ المراجعة: 2026-11-10. النطاق: الواجهة، Cloudflare Worker، Edge Functions الموجودة في المستودع، الـ migrations، والإعدادات.
تحديث v40: بداية نضيفة — قاعدة البيانات كاملة وكل الدوال بقت جوه المستودع ومراجَعة ومختبرة (لا توجد أجزاء خارج النطاق).

## تم إصلاحه

| # | الخطورة | المشكلة | الإصلاح |
|---|---|---|---|
| S1 | **حرجة** | سر بوابة الـ Worker ↔ Edge Functions كان مكتوبًا في `_worker.js` و`_shared/wow.ts`، وبصمته (hash) في `create-order`. | اتشال من الكود نهائيًا وبقى في متغيرات بيئة بس (`LAMSA_WOW_GATEWAY_SECRET`). المستودع على GitHub اترفع من غير التاريخ القديم اللي فيه السر. البداية الجديدة بتستخدم سر جديد (DEPLOYMENT §1)، والمشروع القديم يتمسح. |
| S10 | عالية | عنوان مشروع Supabase والمفتاح العام كانوا مكتوبين في الكود والـ CSP. | بقوا متغيرات Cloudflare (`SUPABASE_URL`، `SUPABASE_PUBLISHABLE_KEY`) بتتقرا من `/env.js`. الـ CSP بيسمح بـ `*.supabase.co` بس. |
| S11 | متوسطة | صفحتي دخول الإدارة وإعداد المالك فيهم سكربتات inline. | اتنقلوا لملفات خارجية. `claim-owner` بيقبل كود سري بمقارنة digest، وبيرفض بعد أول مالك، وعليه حد 5 محاولات في الساعة. |
| S2 | عالية | `order-wow-selection` كان بيمرر إعدادات الألعاب غير المعروفة كما هي (`...c`)، يعني أي حقول يبعتها العميل كانت بتتخزن وتتعرض. | schema صريح لكل لعبة في `_shared/game-sanitize.ts` يحدد طول كل حقل وأنواعه، ويرفض اللعبة اللي من غير بيانات. عليه اختبارات وحدة. |
| S3 | عالية | ملفات النشر كانت بتشمل `supabase/` و`tests/` وملفات `*.md`. | `tools/build.mjs` بيبني `dist/` من الملفات اللي الصفحات بتوصلها فعلًا، وبيستبعد docs/tests/supabase/.env، وبيفحص المخرجات بحثًا عن أسرار (JWT بصلاحية service_role، `sb_secret_`، مفاتيح خاصة) ويوقف البناء لو لقى حاجة. |
| S4 | متوسطة | CSP العام كان فيه `script-src 'unsafe-inline'`. و`memory.html` و`order-success.html` فيهم سكربتات inline (والأول كان بيتمنع أصلًا على `/m/*`). | السكربتات اتنقلت لملفات خارجية. CSP بقى من غير `unsafe-inline` للسكربتات ومعاه `script-src-attr 'none'`. |
| S5 | متوسطة | `create-order` ما كانش بياخد IP العميل الحقيقي من الـ Worker. | الـ Worker بقى يبعت السر مع كل الدوال، فـ rate limit لكل IP بقى شغال لإنشاء الطلبات. |
| S6 | متوسطة | لا يوجد سجل للتعديلات الإدارية. | `admin_audit_logs` + triggers على الكتالوج وحالات الطلب والنشر والألعاب. السجل للقراءة بس، والكتابة عن طريق trigger `security definer`. |
| S7 | متوسطة | تعديل الأسعار ما كانش متقيد بدور. | سياسة RLS: `owner`/`admin` بس (`lamsa_is_admin()`). الـ `editor` يقدر يشوف ومايقدرش يعدّل (مختبر في `tests/db/rls-tests.sql`). |
| S8 | منخفضة | صفحات الطلب والنجاح والتتبع ممكن تتخزن في Cache. | `Cache-Control: no-store` + `noindex` لـ `/order`، `/order-success.html`، `/track.html`، `/m/*`، `/admin/*`. |
| S9 | منخفضة | صفحات التتبع والنجاح كانت بتحمّل Supabase SDK من CDN خارجي من غير لزوم. | استبدلناه بـ `lib/api.js` (عن طريق الـ Worker). الـ SDK بيتحمل في الإدارة بس. |

## تم فحصه وهو سليم

- **XSS**: كل النصوص اللي العميل بيكتبها بتتعرض بـ `textContent` أو بعد `escapeHtml/esc` (الويزارد، صفحة الذكرى، وحدات الألعاب `ctx.esc`، الإدارة). اختبار وحدة بيتأكد إن payload فيه `<img onerror>` بيتخزن كنص وبيتقص لأقصى طول.
- **SQL Injection**: مفيش SQL بيتبني كنص؛ كل الوصول عن طريق PostgREST/supabase-js بقيم parameterized. الـ RPCs بتاخد parameters مكتوب نوعها.
- **IDOR / الوصول لذكرى عميل تاني**: الذكرى بتتجاب بالـ `slug` العشوائي (64-bit hex) وبشرط `is_published`. العمليات على الطلب محتاجة `trackingToken` (HMAC بمفتاح السيرفر، والقاعدة فيها الـ hash بس). جداول الطلبات والذكريات مقفولة على anon (مختبر محليًا).
- **تخمين الروابط والأكواد**: rate limit لكل IP على `public-memory` (120 طلب كل 10 دقايق، و1500 إجمالي)، وعلى `wow-event`، `wow-hunt-step`، `create-order` (5/ساعة/IP + 4/ساعة/رقم + 250/ساعة إجمالي)، `wow-love-wrapped`، `wow-rewrite`.
- **رفع ملفات ضارة**: نوع الملف والحجم بيتفحصوا في الواجهة، وفي الـ Worker (قائمة MIME مسموحة + حد للحجم)، وفي `create-order` (حسب الباقة)، وفي Bucket (`allowed_mime_types`). المسار ثابت `orderId/uuid-name` وبيترفض أي `..`. الرفع عن طريق Signed Upload URL صالح لمرة واحدة. كل صورة بتتعاد كتابتها بـ canvas قبل الرفع، فبيانات EXIF/GPS (الموقع) ما بتخرجش من الموبايل. استثناء نادر: صورة PNG كبرت بعد إعادة الكتابة عن الحد بتترفع زي ما هي.
- **Spam**: honeypot + Turnstile (اختياري) + rate limits + `requestId` idempotent بيمنع الطلب المكرر.
- **مفاتيح Supabase في الواجهة**: المفتاح الوحيد هو الـ publishable/anon، وده عام بطبيعته ومحمي بـ RLS. مفيش service_role.
- **Console**: الكود الجديد مش بيسجل بيانات شخصية. الكود القديم بيسجل رسائل خطأ تقنية بس.
- **Security headers**: HSTS، CSP، X-Frame-Options، COOP، Referrer-Policy (`no-referrer` على الذكرى)، Permissions-Policy، nosniff.

## محتاج قرار أو إجراء منك

1. **سر جديد** للبوابة في Supabase وCloudflare (DEPLOYMENT §1) — إلزامي.
2. **`REQUIRE_LAMSA_GATEWAY=true`** في Supabase بعد ما تتأكد إن الـ Worker شغال بالسر الجديد، عشان `create-order` مايتنداش مباشرة من برا الـ Worker.
3. **Turnstile**: موصى به قبل أي حملة إعلانات. ضيف `TURNSTILE_SITE_KEY` (Cloudflare) و`TURNSTILE_SECRET_KEY` (Supabase) مع بعض. لو اتحط واحد بس، الطلبات هتفشل.
4. بعد إنشاء حساب المالك امسح `OWNER_SETUP_CODE` من أسرار Supabase.
5. شغّل Security Advisor في Supabase بعد `db push` وتأكد إن مفيش تحذيرات RLS.
6. **حماية الذكرى بكلمة سر**: موجودة كبوابة «سؤال سري» (`wow-unlock`) وبتتفعل من محرر الذكرى. اعرضها على العملاء كخيار.
7. **حذف البيانات**: الطلب بيتم يدويًا عن طريق واتساب. ممكن بعدين نعمل زر «احذف ذكرياتي» بالـ trackingToken.
8. **سجل التدقيق**: المحتوى بيتعدل من `memory-editor` مباشرة على جداول عليها trigger (`memories`، `memory_wow_moments`). تعديل `memory_media` مش متسجل.
9. **الاحتفاظ بالبيانات**: حدد مدة احتفاظ بعدها الطلبات المكتملة تتحذف أو تتجهّل (anonymize) أوتوماتيك.
