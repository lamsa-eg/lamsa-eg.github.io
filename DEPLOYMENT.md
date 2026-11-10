# تشغيل لمسة من الصفر (v40)

> الدليل ده لبداية نضيفة: مشروع Supabase جديد + مشروع Cloudflare Pages جديد مربوط بـ GitHub.
> المستودع فيه **كل حاجة**: قاعدة البيانات كاملة، كل الدوال، والموقع. مفيش أجزاء مخفية على أي سيرفر.

الوقت المتوقع: 30–45 دقيقة. هتحتاج: حساب Supabase، وحساب Cloudflare، وجهاز عليه Node.js 22 (للأوامر).

---

## 0) تنظيف القديم (اختياري)

مفيش طلبات حقيقية، فالمسح آمن:
- **Cloudflare** → Workers & Pages → المشروع القديم → Settings → (آخر الصفحة) **Delete project**.
- **Supabase** → المشروع القديم → Project Settings → General → **Delete project**.

> لو حابب تحتفظ بأي بيانات تجريبية، خد Backup الأول. بعد المسح مفيش رجوع.

---

## 1) أسرار هتحتاجها (اعملها مرة واحدة واحفظها في مكان آمن)

على جهازك:
```bash
openssl rand -hex 32   # ← LAMSA_WOW_GATEWAY_SECRET  (نفس القيمة في Supabase وCloudflare)
openssl rand -hex 16   # ← OWNER_SETUP_CODE          (كود إنشاء حساب المالك، لمرة واحدة)
```
**ممنوع** تكتب أي سر منهم في الكود أو في GitHub أو في الشات.

---

## 2) Supabase — مشروع جديد

1. https://supabase.com/dashboard → **New project**
   - Name: `lamsa` · Region: **Central EU (Frankfurt)** (الأقرب لمصر) · احفظ كلمة سر قاعدة البيانات.
2. بعد ما يجهز: Project Settings → **API Keys** → انسخ:
   - **Project URL** (زي `https://abcd1234.supabase.co`)
   - **Publishable key** (`sb_publishable_...`) — ده عام وآمن للواجهة.
   - **ماتنسخش** الـ secret/service_role key لأي مكان.
3. من فولدر المشروع على جهازك:
```bash
git clone https://github.com/ainelhaya255/Lamsa.git && cd Lamsa
npx supabase@latest login
npx supabase@latest link --project-ref <PROJECT_REF>        # الـREF هو الجزء قبل .supabase.co
npx supabase@latest db push                                  # ينشئ كل الجداول والصلاحيات والتخزين
npx supabase@latest secrets set \
  LAMSA_WOW_GATEWAY_SECRET=<السر_الأول> \
  OWNER_SETUP_CODE=<كود_المالك> \
  ALLOWED_ORIGIN=https://lamsa-eg.pages.dev \
  REQUIRE_LAMSA_GATEWAY=true
npx supabase@latest functions deploy                         # ينشر كل الدوال (25 دالة)
```
4. (اختياري) `NOTIFY_EMAIL=<إيميلك>` للإشعارات، و`TURNSTILE_SECRET_KEY` للحماية من البوتات، و`ANTHROPIC_API_KEY` لمساعد الكتابة.

> **بدون CLI؟** SQL Editor ← شغّل ملفات `supabase/migrations/` بالترتيب (من الأقدم للأحدث)، لكن نشر الدوال محتاج CLI.

---

## 3) Cloudflare Pages — مربوط بـ GitHub

1. Cloudflare → **Workers & Pages** → Create → **Pages** → **Connect to Git** → اختار `ainelhaya255/Lamsa`.
2. الإعدادات:
   | الحقل | القيمة |
   |---|---|
   | Project name | `lamsa-eg` (← الرابط هيبقى `lamsa-eg.pages.dev`) |
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
3. **Environment variables** (Production و Preview):
   | المتغير | النوع | القيمة |
   |---|---|---|
   | `NODE_VERSION` | Plain | `22` |
   | `SUPABASE_URL` | Plain | Project URL من خطوة 2 |
   | `SUPABASE_PUBLISHABLE_KEY` | Plain | Publishable key من خطوة 2 |
   | `SITE_URL` | Plain | `https://lamsa-eg.pages.dev` |
   | `LAMSA_WOW_GATEWAY_SECRET` | **Secret** | نفس السر الأول |
   | `TURNSTILE_SITE_KEY` | Plain | اختياري (لازم مع `TURNSTILE_SECRET_KEY`) |
4. **Save and Deploy**. بعد كده أي تعديل يتحفظ على `main` بيتنشر تلقائيًا، وأي فرع تاني بياخد رابط معاينة.

> لو اسم `lamsa-eg` مش متاح، اختار اسم تاني، وحدّث `ALLOWED_ORIGIN` في Supabase و`SITE_URL` في Cloudflare.

---

## 4) حساب المالك (مرة واحدة)

1. افتح `https://lamsa-eg.pages.dev/admin/setup-owner.html`
2. اكتب اسمك وإيميلك وكلمة سر (12 حرف على الأقل) و**كود المالك**.
3. بعد النجاح: Supabase → Edge Functions → Secrets → **امسح `OWNER_SETUP_CODE`** (الدالة بترفض أصلًا بعد أول مالك، ده احتياط زيادة).
4. سجّل دخول من `/admin/login.html` ← **الباقات والألعاب**: راجع الأسعار، وحدد أسعار الشحن من **الشحن**.

مشرفين إضافيين: Supabase → Authentication → Add user، ثم SQL Editor:
```sql
insert into public.admin_profiles(user_id, display_name, role) values ('<USER_ID>', 'الاسم', 'editor'); -- أو admin
```

---

## 5) إشعارات الموبايل للإدارة (اختياري)

```bash
npx web-push generate-vapid-keys
```
SQL Editor:
```sql
insert into public.notification_settings(id, vapid_public_key, vapid_private_key)
values ('default', '<PUBLIC>', '<PRIVATE>')
on conflict (id) do update set vapid_public_key = excluded.vapid_public_key, vapid_private_key = excluded.vapid_private_key;
```
بعدها من لوحة الإدارة اضغط جرس الإشعارات ← فعّل.

---

## 6) التحقق (5 دقائق)

1. `https://lamsa-eg.pages.dev/version.txt` ← `cf-v40-fresh-start`.
2. الرئيسية: الباقات بأسعار القاعدة. «شوف التجربة» يفتح الذكرى التجريبية.
3. `/order`: طلب تجريبي بصورة + لعبة «مين فينا؟» ← رقم طلب.
4. الإدارة: الطلب ظاهر + إشعار ← افتح الطلب ← اسحب الملفات للذكرى ← انشر ← افتح رابط الذكرى ← افتح الظرف ← العب.
5. `/m/m-0000000000000000` ← «الرابط ده مش صحيح…».
6. `/supabase/` و`/DEPLOYMENT.md` ← 404 (مش بيتنشروا).

لو ظهر «الموقع لسه ما اتربطش بقاعدة البيانات»: راجع `SUPABASE_URL` و`SUPABASE_PUBLISHABLE_KEY` في Cloudflare ثم Retry deployment.

---

## 7) دومين خاص لاحقًا
Cloudflare Pages → Custom domains → أضف الدومين، ثم حدّث `SITE_URL` (Cloudflare) و`ALLOWED_ORIGIN` (Supabase)، والروابط في `index.html` (canonical/og) و`sitemap.xml` و`robots.txt`.
