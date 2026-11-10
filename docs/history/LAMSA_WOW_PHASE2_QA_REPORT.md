# LAMSA WOW Phase 2 — QA Report

## النتيجة

- PASS — البناء فوق V28 + WOW Phase 1 بدون استبدال الوظائف القديمة.
- PASS — Moment جديد `gender_reveal` يُحمّل Lazy فقط للذكريات المفعّل بها.
- PASS — لوحة إعداد داخل محرر الذكرى لاختيار النتيجة والنصوص.
- PASS — النتيجة محفوظة في `wow_gender_reveals` وليست في إعدادات Moment العامة.
- PASS — `public-memory` يحذف حقول النتيجة الحساسة دفاعيًا حتى لو وُجدت داخل Config قديم.
- PASS — استجابات `unconfigured` و`waiting` و`countdown` لا تحتوي مفتاح `result`.
- PASS — النتيجة تُرجع فقط بعد وصول توقيت السيرفر إلى `reveal_at`.
- PASS — بدء الكشف يتطلب رقم الطلب ورمز المتابعة الصحيحين.
- PASS — الموعد يُحدد ذريًا باستخدام Transaction Advisory Lock؛ تكرار الضغط لا يغير الموعد.
- PASS — RLS مفعّل، ووصول `anon` و`authenticated` للجداول الجديدة مسحوب صراحة.
- PASS — فهارس حضور الأجهزة موجودة للاستعلام حسب الذكرى وآخر ظهور.
- PASS — عدّاد الأجهزة النشطة يعتمد آخر 45 ثانية بدون كشف هوية أو تخزين Session خام.
- PASS — Rate limits منفصلة للبدء والتحديث مع حد عام.
- PASS — وضع Reduce Motion مدعوم.
- PASS — نسخة الإدارة تعرض Preview آمنًا بدون النتيجة.

## JavaScript syntax

- PASS — `_worker.js`
- PASS — `assets/js/memory-cf-v28-wow-p2.js`
- PASS — `assets/js/wow/wow-core.js`
- PASS — `assets/js/wow/track-phase2.js`
- PASS — `assets/js/wow/admin-phase2.js`
- PASS — `assets/js/wow/moments/gender_reveal.js`

## ربط الملفات

- PASS — `memory.html` يستخدم Bundle المرحلة الثانية.
- PASS — `track.html` يستخدم أدوات المرسل للمرحلة الثانية.
- PASS — محرر الذكرى يحمّل لوحة Phase 2.
- PASS — Cloudflare Worker يسمح ويمرر `wow-gender-reveal` عبر Gateway.

## ملاحظات النشر

- لم يتم تعديل قاعدة البيانات أو النشر التلقائي.
- يجب تطبيق Migration المرحلة الثانية قبل نشر Edge Functions الجديدة.
- يلزم اختبار نهائي على بيئة Supabase الحقيقية وجهازين بعد ضبط Secrets المذكورة في دليل النشر.
