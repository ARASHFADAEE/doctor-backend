# MedAI Vision Backend — مستندات کامل پروژه

این پروژه یک سرویس بک‌اند هوشمند برای مدیریت و تحلیل آزمایش‌های پزشکی با قابلیت‌های زیر است:
- احراز هویت مبتنی‌بر OTP و JWT
- آپلود تصویر آزمایش و تحلیل خودکار با مدل‌های هوش مصنوعی (Vision + متن)
- فهرست و جزئیات آزمایش‌ها برای بیمار و دکتر
- داشبورد ادمین: وضعیت سرویس، آمار کلی، سری زمانی، برچسب‌های پرتکرار، مدیریت تست‌ها و کاربران
- مانیتورینگ سلامت هوشمند (Analytics): روند شاخص‌ها، توصیه‌های شخصی‌سازی‌شده، برچسب‌گذاری خودکار

## تکنولوژی‌ها
- `Node.js` + `Express`
- پایگاه داده `MySQL` با `mysql2/promise`
- امنیت و میان‌افزارها: `helmet`, `cors`, `morgan`
- آپلود فایل: `multer`
- احراز هویت: `jsonwebtoken` (JWT)
- اعتبارسنجی ورودی: `express-validator`
- ارسال OTP: سرویس SOAP پنل پیامک (`soap`) با پترن
- هوش مصنوعی: `openai` یا Liara/Gemini از طریق `OpenAI` SDK

## متغیرهای محیطی (.env)
- پایگاه داده: `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`
- احراز هویت: `JWT_SECRET`, `JWT_EXPIRE` (مثل `7d`)
- CORS: `CORS_ORIGIN` (مثلاً `http://localhost:3000`)
- هوش مصنوعی:
  - Liara/Gemini: `LIARA_BASE_URL`, `LIARA_API_KEY`
  - OpenAI: `OPENAI_API_KEY`
  - انتخاب مدل (اختیاری): `AI_MODEL` (اگر ست نشود، به‌صورت خودکار انتخاب می‌شود)
- پیامک: `PAYAMAK_WSDL` (اختیاری، پیش‌فرض), `PAYAMAK_USERNAME`, `PAYAMAK_PASSWORD`, `PAYAMAK_OTP_BODY_ID`

## راه‌اندازی
- نصب وابستگی‌ها: `npm install`
- اجرای توسعه: `npm run dev`
- اجرای تولید: `npm start`
- سرویس روی پورت `PORT` (پیش‌فرض 5000) بالا می‌آید؛ مسیرها از `/api` شروع می‌شوند.

## ساختار دیتابیس (ایجاد خودکار)
- جدول `users`: فیلدها `id`, `phone`, `name`, `national_id`, `age`, `role('patient'|'doctor'|'admin')`, `is_verified`
- جدول `medical_tests`: فیلدها `id`, `patient_id`, `doctor_id`, `image_path`, `description`, `ai_result(TEXT)`, `status('pending'|'processed'|'urgent')`, `created_at`
- جدول `otp_codes`: فیلدها `id`, `phone`, `code`, `expires_at`, `used`, `created_at`

## احراز هویت و نقش‌ها
- توکن‌ها دو نوع هستند:
  - `temp` برای کاربران جدید پس از تأیید OTP جهت تکمیل پروفایل (۱۰ دقیقه)
  - `full` برای کاربران کامل (patient/doctor/admin)
- میان‌افزارها:
  - `attachUser`: توکن را می‌خواند و `req.user` یا `req.tempUserPhone` را پر می‌کند
  - `requireFullAuth`: نیاز به کاربر لاگین‌شده کامل
  - `requireTempAuth`: نیاز به توکن موقت معتبر
  - `requireRole('admin'|'doctor')`: بررسی نقش کاربر

## فهرست روت‌ها و خروجی‌ها

### Auth (`/api/auth`)
- `POST /send-otp`
  - Body: `{ phone: "09XXXXXXXXX" }`
  - Response: `{ success, message, expires_in: 300 }`
- `POST /verify-otp`
  - Body: `{ phone, code }`
  - Response (کاربر موجود): `{ success, token: <JWT>, isNewUser: false, user: { id, phone, role } }`
  - Response (کاربر جدید): `{ success, token: <Temp-JWT>, isNewUser: true, user: { phone, role: 'patient' } }`
- `POST /complete-profile`
  - Headers: `Authorization: Bearer <Temp-JWT>`
  - Body: `{ name, national_id, age }`
  - Response: `{ success, token: <JWT>, user: { id, name, role } }`

### Users (`/api/users`)
- `GET /me` (نیازمند JWT کامل)
  - Response: `{ id, phone, name, national_id, age, role }`
- `PUT /me`
  - Body: `{ name?, age? }`
  - Response: همان ساختار `GET /me`

### Tests (`/api/tests`)
- `POST /upload`
  - Headers: `Authorization: Bearer <JWT>`
  - FormData:
    - `image`: فایل تصویر
    - `description`: متن اختیاری
    - `doctor_id`: شناسه دکتر (اختیاری)
  - Response نمونه:
    ```json
    {
      "test_id": 5,
      "status": "processed",
      "is_urgent": false,
      "result": {
        "schema_version": "1.0",
        "language": "fa-IR",
        "summary": "...",
        "severity": "low",
        "extracted_tags": ["آزمایش خون", "ویتامین D"],
        "potential_diagnoses": [{"name": "کمبود ویتامین D", "confidence": 0.7}],
        "recommendations": ["مصرف مکمل ویتامین D"],
        "confidence": 0.7,
        "reasoning": "...",
        "urgent": false,
        "raw_text": "...",
        "patient_context": { "age": 23, "description": "..." }
      }
    }
    ```
- `GET /` (فهرست تست‌های بیمار؛ برای دکتر هم راحتی)
  - Response: آرایه آیتم‌ها با فیلدهای `id`, `description`, `status`, `severity`, `is_urgent`, `created_at`, `image_path?`, `doctor?`
- `GET /doctor` (فهرست تست‌های مختص دکتر)
  - فقط برای نقش `doctor`؛ مشابه خروجی فوق
- `GET /:id` (جزئیات تست)
  - کنترل دسترسی: بیمار صاحب تست، دکتر مسئول، یا ادمین
  - Response: رکورد کامل؛ `ai_result` به‌صورت رشتهٔ JSON است و باید در فرانت‌اند `JSON.parse` شود

### Admin (`/api/admin`)
- `GET /health`
  - Response: `{ ok: true, timestamp }`
- `GET /stats/overview`
  - Response: `{ users: { total, patients, doctors, admins }, tests: { total, pending, processed, urgent } }`
- `GET /stats/timeseries?days=30`
  - Response: آرایه روزانه `{ date, total, pending, processed, urgent }`
- `GET /stats/tags`
  - Response: `[ { tag, count }, ... ]`
- مدیریت کاربران:
  - `GET /users` → لیست کاربران
  - `POST /users` → ساخت کاربر جدید (فقط `patient|doctor`)
    - Body: `{ phone, name, national_id?, age?, role }`
    - خطاها: 400 (ورودی نامعتبر)، 409 (شماره تکراری)
  - `PUT /users/:id/role` → تغییر نقش به `patient|doctor|admin`
  - `DELETE /users/:id` → حذف کاربر
- مدیریت تست‌ها:
  - `GET /tests` → لیست با فیلترهای اختیاری: `status`, `doctor_id`, `patient_id`, `from`, `to`, `page`, `page_size`
    - خروجی هر آیتم شامل `severity` و `is_urgent` محاسبه‌شده از `ai_result`
  - `GET /tests/:id` → جزئیات تست برای ادمین
    - شامل `patient`, `doctor`, `image_path`, `description`, `ai_result` (رشته)، `status`, `created_at`
  - `PUT /tests/:id` → بروزرسانی وضعیت/دکتر
  - `DELETE /tests/:id` → حذف تست
- مانیتورینگ OTP:
  - `GET /otp-codes?phone=&page=&page_size=`
    - Response: `{ page, page_size, total, items: [{ id, phone, code, used, expires_at, created_at }] }`

### Analytics (`/api/analytics`)
- `GET /trends/:metric?months=6`
  - متریک‌ها: `blood_sugar`, `vitamin_d`, `triglycerides`
  - Response:
    ```json
    {
      "metric": "blood_sugar",
      "months": 6,
      "chartjs": { "labels": ["2025-05"], "datasets": [{ "label": "قند خون", "data": [95] }] },
      "trend_line": [96],
      "slope": 2.3,
      "anomalies": [0],
      "comparison": "قند خون شما 20% افزایش داشته است"
    }
    ```
- `GET /recommendations`
  - Response: `{ recommendations: ["..."] }` بر اساس `ai_result` و سن کاربر
- `POST /auto-tag/:id`
  - Response: `{ id, extracted_tags: ["..."] }` پس از ادغام برچسب‌های استنتاج‌شده

### Static Uploads
- `GET /uploads/<filename>` → دسترسی مستقیم به فایل‌های آپلود شده

## الگوهای درخواست (نمونه‌ها)
- ارسال OTP:
  ```bash
  curl -X POST "http://localhost:5000/api/auth/send-otp" \
    -H "Content-Type: application/json" \
    -d '{"phone":"09123456789"}'
  ```
- آپلود تست:
  ```bash
  curl -X POST "http://localhost:5000/api/tests/upload" \
    -H "Authorization: Bearer <JWT>" \
    -F "image=@/absolute/path/to/test.jpeg" \
    -F "description=توضیح کاربر"
  ```
- ترند و نمودار:
  ```bash
  curl "http://localhost:5000/api/analytics/trends/blood_sugar?months=6" \
    -H "Authorization: Bearer <JWT>"
  ```
- لیست تست‌ها برای ادمین:
  ```bash
  curl "http://localhost:5000/api/admin/tests?page=1&page_size=20" \
    -H "Authorization: Bearer <ADMIN_JWT>"
  ```

## نکات پیاده‌سازی فرانت‌اند
- برای همهٔ مسیرهای غیرعمومی، هدر `Authorization: Bearer <JWT>` الزامی است.
- در لیست تست‌ها از `severity` و `is_urgent` برای رنگ‌بندی و برجسته‌سازی استفاده کنید.
- در جزئیات تست، مقدار `ai_result` رشتهٔ JSON است؛ با `JSON.parse` تبدیل کنید.
- داشبورد ادمین:
  - «روند تست‌ها در 30 روز گذشته»: از `GET /api/admin/stats/timeseries?days=30` استفاده کنید و با Chart.js رندر کنید.
  - «فعالیت‌های اخیر»: از `GET /api/admin/tests?page=1&page_size=20` استفاده کنید و جدیدترین‌ها را نمایش دهید.
  - «برچسب‌های پرتکرار»: از `GET /api/admin/stats/tags` استفاده کنید و نمودار/تگ‌کلاد بسازید.

## خطاها
- 401: توکن ارائه نشده/نامعتبر
- 403: دسترسی غیرمجاز
- 404: رکورد یافت نشد
- 400: ورودی نامعتبر
- 409: تضاد داده (مثلاً شماره تلفن تکراری)
- 429: نرخ درخواست بیش از حد مجاز
- 500: خطای داخلی/AI

## معماری و ماژول‌ها
- `server.js`: راه‌اندازی اپ، میان‌افزارها، استاتیک، ثبت روت‌ها
- `src/db.js`: اتصال MySQL و ساخت جداول
- `src/middleware/auth.js`: JWT و کنترل نقش‌ها
- `src/controllers/*`: منطق هر حوزه (Auth، Users، Tests، Admin، Analytics)
- `src/models/*`: دسترسی دیتابیس برای کاربران، تست‌ها، OTP
- `src/services/openai.service.js`: فراخوانی مدل هوش مصنوعی و نرمال‌سازی نتیجه
- `src/services/sms.service.js`: ارسال پیامک OTP با پترن
- `src/utils/*`: نرمال‌سازی نتایج AI، متریک‌ها، توصیه‌ها، برچسب‌گذاری

## نکات امنیتی
- همهٔ مسیرهای ادمین با `requireRole('admin')` محافظت شده‌اند.
- فرمت شماره تلفن در ساخت کاربر و OTP بررسی می‌شود (`^09\d{9}$`).
- `helmet` و `cors` فعال هستند؛ `CORS_ORIGIN` را مطابق فرانت‌اند تنظیم کنید.

---
این README تصویری کامل از سیستم، روت‌ها، خروجی‌ها و نحوهٔ استفاده ارائه می‌دهد. برای جزئیات بیشتر نمونه‌ها و ادغام فرانت‌اند، فایل `FRONTEND_INTEGRATION.md` را نیز ببینید.