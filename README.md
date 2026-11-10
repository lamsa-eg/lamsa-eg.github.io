# لمسة — LAMSA (v40)

> «مش صفحة صور… دي رحلة معمولة من قصتكم.»

**الموقع:** https://ainelhaya255.github.io/Lamsa/ · **ذكرى تجريبية:** https://ainelhaya255.github.io/Lamsa/memory.html?demo=1

منصة عربية لهدايا ذكرى رقمية تفاعلية: قطعة فيها NFC وQR بتفتح صفحة ذكرى خاصة فيها صور ورسائل وأغنية وخط زمني، وألعاب مبنية من إجابات حقيقية بيكتبها صاحب الهدية وقت الطلب.

## البنية

```
index.html            الصفحة الرئيسية (باقات من القاعدة + تجارب WOW قابلة للعب)
order.html            رحلة الطلب (12 خطوة) ← assets/js/order/*
order-success.html    تأكيد الطلب ورقم المتابعة
memory.html  (/m/*)   صفحة الذكرى ← assets/js/memory.js + assets/js/wow/** (ألعاب)
track.html            متابعة الطلب
admin/                لوحة الإدارة (Supabase Auth + RLS)
  catalog.html        ← جديد: الباقات/الأسعار/الإضافات/المواسم/الألعاب/سجل التعديلات
_worker.js            Cloudflare Pages Worker: /api/* → Edge Functions، /upload/* → Signed Upload
assets/js/lib/        api.js (عميل الـ API)، catalog.js (مصدر الأسعار الوحيد)، ui.js
assets/js/games/      registry.js — تعريف موحد لكل لعبة (الحقول، التحقق، الإعداد)
supabase/functions/   Edge Functions (Deno) + _shared/game-sanitize.ts
supabase/migrations/  قاعدة البيانات كاملة من الصفر (+ rollbacks/، config.toml)
tools/                dev-server.mjs (خادم محلي + Backend وهمي)، build.mjs (بناء dist/)
tests/                unit/ · e2e/ (Playwright) · db/ (Postgres محلي + RLS)
legacy/               ملفات اتستبدلت في v38 (مش بتتنشر)
docs/                 تقرير الفحص، تقرير الاختبارات، الإصدارات القديمة
```

## التشغيل المحلي

```bash
npm install            # esbuild للبناء فقط
npm run dev            # http://localhost:8788 مع Backend وهمي (بيانات تخيلية)
```

الخادم المحلي بيقلّد Cloudflare Pages (`/m/*`، `_redirects`، pretty URLs) وكل الـ Edge Functions اللي رحلة الطلب والذكرى محتاجاها. عشان تشوف الذكرى بعد طلب تجريبي: `POST /__mock/publish {"orderNumber":"…"}` ثم افتح `/m/<slug>`.

## الاختبارات

```bash
npm run test:unit      # عقد الألعاب: مخرجات الويزارد ↔ sanitizer السيرفر
npm run test:e2e       # رحلة كاملة: الرئيسية → الطلب → الإرسال → النشر → لعب الذكرى
npm run test:visual    # 6 مقاسات × الصفحات: أخطاء Console + تمرير أفقي + لقطات
npm run test:db        # migrations مرتين + RLS + rollback على Postgres مؤقت
```

## البناء والنشر

```bash
npm run build          # dist/
npm run build:zip      # lamsa-cloudflare-pages-v40.zip
npm run build:pages    # dist-pages/ لـ GitHub Pages (بيتعمل تلقائي في GitHub Actions)
```

خطوات النشر كاملة في **[DEPLOYMENT.md](DEPLOYMENT.md)** (فيها خطوة **إلزامية**: تغيير سر البوابة). قاعدة البيانات: **[DATABASE.md](DATABASE.md)**. الأمان: **[SECURITY_REVIEW.md](SECURITY_REVIEW.md)**. التغييرات: **[CHANGELOG.md](CHANGELOG.md)**.

## قواعد مهمة

- الأسعار في جدول `packages` بس (+ `wow_addons`، `wow_packs`) وبتتعدل من `admin/catalog.html`. ممنوع تكتب سعر في HTML أو JS.
- إضافة لعبة: entry في `assets/js/games/registry.js` + schema في `supabase/functions/_shared/game-sanitize.ts` + صف في `game_catalog`. صفحة الطلب مش محتاجة أي تعديل.
- مفيش محتوى تجريبي للمستلم الحقيقي: اللعبة اللي ملهاش بيانات ما بتظهرش.
- ممنوع أي secret في الكود. المتغيرات في `.env.example`.
