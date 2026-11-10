# قاعدة بيانات لمسة (Supabase / Postgres)

> الجداول الأساسية اتعملت على المشروع الحي قبل ما يبقى فيه migrations في المستودع. البنية هنا مستنتجة من الكود (الواجهة + Edge Functions) ومن الـ migrations الموجودة. **لم يتم إنشاء أي جدول بديل لجدول موجود.**

## خريطة الجداول مقابل المطلوب

| المطلوب في الخطة | الموجود فعلًا | ملاحظة |
|---|---|---|
| profiles / admin roles | `admin_profiles(user_id, display_name, role: owner/admin/editor)` | تسجيل الدخول بـ Supabase Auth |
| orders | `orders` | بيانات الطلب + الشحن + الأسعار + `story_answers jsonb` + `wow_*` |
| order_participants | أعمدة `sender_name`, `recipient_name`, `recipient_gender` في `orders`/`memories` | لا حاجة لجدول منفصل حاليًا |
| memories | `memories` (`slug` عشوائي `m-` + 16/32 hex، `is_published`) | |
| memory_events / الخط الزمني | `story_answers.milestones` + لعبة `order_story` (`events`) | |
| media_files | `order_uploads` (ملفات العميل الخام) + `memory_media` (الملفات المنشورة) | Bucket خاص `order-uploads` + روابط موقعة |
| packages | `packages` (+ أعمدة v38) | **المصدر الوحيد للأسعار** |
| games / order_games / game_answers | `memory_wow_moments(type, config jsonb)` + `game_catalog` (v38) | الإجابات الحقيقية داخل `config`؛ التفعيل/الإيقاف في `game_catalog` |
| game_questions | داخل `config` لكل لعبة | بنية موحدة من `assets/js/games/registry.js` |
| gifts / delivery_details | أعمدة الشحن في `orders` + `shipping_zones` + `nfc_tags` | |
| memory_access | `memory_wow` (gates: ختم/قفل بموعد/سؤال سري) + `memory_wow_state` | |
| admin_audit_logs | `admin_audit_logs` (v38) | Triggers تلقائية |
| app_settings / seasonal_offers | `seasons`, `wow_addons`, `wow_packs` | |
| rate limiting | `consume_rate_limit()` (RPC على المشروع الحي) | |

## v38 — `20261110_lamsa_v38_catalog_admin.sql`

- `packages`: `max_games`, `is_recommended`, `tagline`, `features text[]`, `updated_at` + سياسة تعديل للـ owner/admin فقط.
- `game_catalog(key, label, description, active, sort_order, min_package)`: قراءة عامة (بدون بيانات حساسة)، تعديل للإدارة.
- `admin_audit_logs`: يسجل الأعمدة اللي اتغيرت بس، مع المستخدم ودوره. في `orders` بيسجل أعمدة التشغيل فقط (الحالة، الدفع، المبالغ)، **وما بيسجلش** العنوان أو الموبايل أو الرسائل.
- `lamsa_is_admin()`: دالة `security definer` تُستخدم داخل سياسات RLS.

## بنية بيانات الألعاب (موحدة)

كل لعبة يختارها العميل تتحفظ كصف في `memory_wow_moments`:

```json
{ "type": "game", "sort_order": 200,
  "config": { "game": "quiz", "lamsaGame": "who_of_us", "title": "مين فينا؟",
              "questions": [{ "q": "مين بيتأخر؟", "options": ["سارة","يوسف","إحنا الاتنين"], "answer": 1, "reactions": ["…","صح ♡ ربع ساعة 😄","…"] }],
              "reward": { "type": "message", "text": "…" }, "skippable": true, "playOnce": true } }
```

- `imageRef` = ترتيب الصورة بين صور العميل المرفوعة (0 = أول صورة). صفحة الذكرى بتحوّله لرابط موقّع.
- `reward` **ما بيتبعتش للمستلم** قبل الفوز (`public-memory` بيشيله، و`wow-event` بيرجعه بعد الفوز فقط).
- إضافة لعبة جديدة: entry في `registry.js` + schema في `_shared/game-sanitize.ts` + (لو محتاجة شكل جديد) ملف في `assets/js/wow/legacy/moments/game-<key>.js` + صف في `game_catalog`.

## RLS — الملخص

| الجدول | anon | مستخدم مسجل | editor | owner/admin | Edge Functions (service role) |
|---|---|---|---|---|---|
| packages | قراءة النشط | قراءة النشط | قراءة | قراءة/تعديل | كامل |
| game_catalog | قراءة | قراءة | قراءة | تعديل | كامل |
| orders / memories / uploads | ✗ | ✗ | حسب سياسات المشروع الحي (admin_profiles) | ✓ | كامل |
| memory_wow* / wow_events / wow_letters / wow_referrals | ✗ | ✗ | ✓ (بعضها) | ✓ | كامل |
| admin_audit_logs | ✗ | ✗ | ✗ | قراءة فقط | كتابة عن طريق Trigger |

الوصول العام للذكرى يتم **فقط** عن طريق `public-memory`، بالـ `slug` العشوائي، وبشرط `is_published=true`.

## اختبار محلي للـ migrations وRLS

```bash
npm run test:db   # Postgres محلي مؤقت: schema بديل + كل الـ migrations مرتين + اختبارات RLS + rollback
```

الـ schema البديل في `tests/db/stub-base-schema.sql` تقريبي. قبل الإنتاج شغّل الـ migration على **Supabase Branch** أو نسخة staging، أو بعد نسخة احتياطية.
