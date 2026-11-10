# نشر لمسة v38 على Cloudflare Pages وSupabase

> اقرأ الخطوات بالترتيب. الخطوات المعلّمة **⚠ مطلوبة** لازم تتعمل قبل أو مع النشر. بدونها الألعاب والإجابات مش هتتحفظ.

## 0) نظرة سريعة

| البند | القيمة |
|---|---|
| نوع المشروع | موقع Static + Cloudflare Pages Worker (`_worker.js` advanced mode) |
| Build command | `npm run build` (أو اتركه فارغًا وارفع `dist/` جاهز) |
| Build output directory | `dist` |
| Node | 22 |
| ملف الرفع المباشر | `lamsa-cloudflare-pages-v39.zip` (محتوى `dist/`) |

## 1) ⚠ تغيير سر البوابة (Rotate) — مطلوب فورًا

الإصدارات حتى V37 كانت فيها قيمة `LAMSA_WOW_GATEWAY_SECRET` مكتوبة داخل `_worker.js` و`supabase/functions/_shared/wow.ts`، وأي حد معاه ملف ZIP قديم يقدر يستخدمها. v38 شالها من الكود نهائيًا. **لازم تعمل سر جديد:**

```bash
openssl rand -hex 32     # انسخ الناتج (64 حرف)
```

1. **Supabase** → Project Settings → Edge Functions → Secrets → أضف/عدّل `LAMSA_WOW_GATEWAY_SECRET` = القيمة الجديدة.
2. **Cloudflare** → Workers & Pages → مشروعك → Settings → Variables and Secrets → Add → النوع **Secret** → `LAMSA_WOW_GATEWAY_SECRET` = نفس القيمة (Production و Preview).
3. أعد نشر دوال Supabase (الخطوة 3) ثم الموقع (الخطوة 4).

لو الـ Worker اشتغل من غير السر: صفحات الذكرى العادية تفضل شغالة، لكن الألعاب وحفظ اختيارات الألعاب هيرجعوا خطأ 503.

## 2) ⚠ قاعدة البيانات (Supabase)

1. خد نسخة احتياطية: Dashboard → Database → Backups (أو `pg_dump`).
2. شغّل الـ migration الجديد **بس** (القديمة متطبقة عندك بالفعل):
   - SQL Editor → الصق محتوى `supabase/migrations/20261110_lamsa_v38_catalog_admin.sql` → Run.
   - أو بالـ CLI: `supabase db push`.
3. الملف إضافي فقط (لا يحذف ولا يعيد تسمية أي شيء) وآمن لو اتشغّل مرتين. الرجوع: `20261110_lamsa_v38_catalog_admin.rollback.sql`.
4. بعد التشغيل راجع الأسعار من لوحة الإدارة ← «الباقات والألعاب».

## 3) ⚠ نشر دوال Edge المعدلة

```bash
supabase login
supabase link --project-ref qwavanugzcjevhtzjfuo
supabase functions deploy order-wow-selection create-order public-memory wow-event wow-admin-config wow-catalog wow-unlock wow-reply wow-open-notify wow-sender-subscribe wow-track-replies wow-gender-reveal wow-generate wow-hunt-step wow-love-wrapped wow-rewrite wow-sender-timeline
```

كل الدوال اللي بتستخدم `_shared/wow.ts` لازم تتنشر تاني، لأن السر القديم اتشال من الملف المشترك.
الدوال `complete-order` و`abort-order` و`track-order` و`attach-special-media` و`order-notify-admin` و`admin-*` و`claim-owner` **مش موجودة في الـ ZIP** (موجودة على Supabase بس) — **ماتمسحهاش**.

## 4) نشر الموقع

### الطريقة أ — رفع مباشر (Direct Upload)
1. على جهازك: `npm install && npm run build:zip` (أو استخدم `lamsa-cloudflare-pages-v39.zip` الجاهز).
2. Cloudflare → Workers & Pages → مشروع `lamsagift` → Create deployment → ارفع **محتوى** `dist/` (أو ملف الـ ZIP).

### الطريقة ب — ربط Git
- Framework preset: None · Build command: `npm run build` · Output: `dist` · Env: `NODE_VERSION=22`.

## 5) متغيرات البيئة

| المكان | المتغير | النوع | مطلوب؟ |
|---|---|---|---|
| Cloudflare | `LAMSA_WOW_GATEWAY_SECRET` | Secret | ✅ |
| Cloudflare | `TURNSTILE_SITE_KEY` | Plain | اختياري |
| Cloudflare | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Plain | اختياري (لهم قيم افتراضية) |
| Cloudflare | `WOW_ENABLED` | Plain | اختياري (`false` لإيقاف الألعاب) |
| Supabase | `LAMSA_WOW_GATEWAY_SECRET` | Secret | ✅ |
| Supabase | `ALLOWED_ORIGIN` | Secret | ✅ (`https://lamsagift.pages.dev` أو دومينك) |
| Supabase | `TURNSTILE_SECRET_KEY` | Secret | اختياري — لو اتحط لازم `TURNSTILE_SITE_KEY` يتحط في Cloudflare |
| Supabase | `REQUIRE_LAMSA_GATEWAY` | Secret | موصى به: `true` بعد التأكد إن السر شغال |
| Supabase | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Secret | اختياري (مساعد الكتابة) |

قالب كامل في `.env.example`. **ممنوع** وضع `service_role` أو أي secret key في الواجهة أو في Git.

## 6) التحقق بعد النشر (5 دقائق)

1. `https://<domain>/version.txt` ← `cf-v39-nile-sunset`.
2. الرئيسية: الباقات بتظهر بأسعار القاعدة (مش رقم ثابت). لو ظهرت «مقدرناش نحمّل الأسعار» راجع `/api/public-config`.
3. `/order`: كمّل طلب تجريبي بصورة واحدة ولعبة «مين فينا؟» → صفحة نجاح ورقم طلب.
4. لوحة الإدارة → الطلب ظاهر، والألعاب ظاهرة في تفاصيل الطلب → سحب الملفات → نشر → افتح رابط الذكرى → العب اللعبة بنفس إجاباتك.
5. افتح `/m/m-0000000000000000` ← رسالة «الذكرى غير متاحة».
6. `https://<domain>/supabase/` و`/DEPLOYMENT.md` ← 404 (مش بيتنشروا).
7. Security headers: `curl -I https://<domain>/` فيه `Content-Security-Policy` و`Strict-Transport-Security`.

## 7) دومين خاص (اختياري)
Custom domains → أضف الدومين، ثم حدّث: `ALLOWED_ORIGIN` في Supabase، و`SITE_URL` في `assets/js/config-cf-v4.js`، والـ canonical/OG في `index.html`، و`sitemap.xml`، و`robots.txt`.

## 8) الرجوع لنسخة سابقة
Cloudflare → Deployments → النسخة السابقة → «Rollback to this deployment». الـ migration إضافي فلا يكسر النسخ القديمة. لو رجعت لـ V37 لازم ترجع السر القديم في Supabase مؤقتًا (غير مستحسن).
