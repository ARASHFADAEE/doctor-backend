# 📋 راهنمای اتصال فرانت‌اند به بک‌اند MedAI Vision

این سند، تمام APIهای موجود، نحوه استفاده، ساختار پاسخ‌ها و نکات پیاده‌سازی در فرانت‌اند را بر اساس رفتار واقعی سرویس شما مستندسازی می‌کند.

## 🔧 تنظیمات پایه

```javascript
export const API_BASE_URL = 'http://localhost:8889/api';

export const defaultHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

export const getToken = () => localStorage.getItem('auth_token');
export const getTokenType = () => localStorage.getItem('token_type');
export const isLoggedIn = () => !!getToken();
export const saveToken = (data) => {
  localStorage.setItem('auth_token', data.token);
  // نوع توکن در پاسخ به‌صورت پرچم‌ها می‌آید؛ برای سازگاری ذخیره کن
  localStorage.setItem('token_type', data.isNewUser ? 'temporary' : 'full');
  if (data.user) localStorage.setItem('user_data', JSON.stringify(data.user));
};
export const logout = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('token_type');
  localStorage.removeItem('user_data');
};
```

## 🔐 احراز هویت (OTP + JWT)

### ارسال OTP
- Endpoint: `POST /api/auth/send-otp`
- Body: `{ "phone": "09XXXXXXXXX" }`
- Response:
```json
{ "success": true, "message": "کد تأیید ارسال شد", "expires_in": 300 }
```

### تأیید OTP
- Endpoint: `POST /api/auth/verify-otp`
- Body: `{ "phone": "09XXXXXXXXX", "code": "1234" }`
- Response (کاربر موجود):
```json
{
  "success": true,
  "token": "<JWT>",
  "isNewUser": false,
  "user": { "id": 1, "phone": "0912...", "role": "patient" }
}
```
- Response (کاربر جدید):
```json
{
  "success": true,
  "token": "<Temp-JWT>",
  "isNewUser": true,
  "user": { "phone": "0912...", "role": "patient" }
}
```

### تکمیل پروفایل (کاربر جدید)
- Endpoint: `POST /api/auth/complete-profile`
- Headers: `Authorization: Bearer <Temp-JWT>`
- Body: `{ "name": "نام", "national_id": "1234567890", "age": 30 }`
- Response:
```json
{ "success": true, "token": "<JWT>", "user": { "id": 1, "name": "...", "role": "patient" } }
```

## 👤 کاربر

### دریافت پروفایل من
- Endpoint: `GET /api/users/me`
- Headers: `Authorization: Bearer <JWT>`
- Response:
```json
{ "id": 1, "phone": "0912...", "name": "...", "national_id": "...", "age": 30, "role": "patient" }
```

### به‌روزرسانی پروفایل
- Endpoint: `PUT /api/users/me`
- Headers: `Authorization: Bearer <JWT>`
- Body: `{ "name": "...", "age": 31 }`
- Response:
```json
{ "id": 1, "phone": "0912...", "name": "...", "national_id": "...", "age": 31, "role": "patient" }
```

## 🏥 تست‌های پزشکی

### آپلود و تحلیل تصویر
- Endpoint: `POST /api/tests/upload`
- Headers: `Authorization: Bearer <JWT>`
- FormData:
  - `image`: فایل تصویر
  - `description`: توضیح اختیاری
- Response واقعی سرویس:
```json
{
  "test_id": 5,
  "status": "processed",
  "is_urgent": false,
  "result": {
    "schema_version": "1.0",
    "language": "fa-IR",
    "summary": "خلاصه کوتاه",
    "severity": "low",
    "extracted_tags": ["آزمایش خون", "ویتامین D"],
    "potential_diagnoses": [
      { "name": "کمبود ویتامین D", "confidence": 0.7, "notes": "..." }
    ],
    "recommendations": ["مصرف مکمل ویتامین D"],
    "confidence": 0.7,
    "reasoning": "توضیح مدل...",
    "urgent": false,
    "raw_text": "متن استخراج‌شده...",
    "patient_context": { "age": 23, "description": "..." }
  }
}
```

### لیست تست‌های کاربر (Patient) و دکتر
- Endpoint (Patient): `GET /api/tests`
- Endpoint (Doctor): `GET /api/tests/doctor`
- Headers: `Authorization: Bearer <JWT>`
- Response (آرایه‌ای از آیتم‌ها):
```json
[
  {
    "id": 5,
    "description": "تست نمایشی برای بررسی نتیجه ساختاریافته",
    "status": "urgent",
    "severity": "high",
    "is_urgent": true,
    "created_at": "2025-10-31T17:23:26.000Z",
    "image_path": "uploads/test_1761931406398_889267886.jpeg",
    "doctor": null
  }
]
```

نکته: در فهرست، علاوه بر `status`، فیلدهای `severity` (`low | medium | high`) و `is_urgent` نیز ارائه می‌شوند تا بتوانید رنگ‌بندی و اولویت را در UI اعمال کنید. خودِ `ai_result` در لیست برگردانده نمی‌شود؛ برای مشاهدهٔ جزئیات و خلاصه، روی آیتم کلیک کنید و پاسخ `GET /api/tests/:id` را پارس کنید. (در صورت نیاز می‌توانیم فیلد `ai_summary` را هم به خروجی لیست اضافه کنیم.)

### جزئیات تست
- Endpoint: `GET /api/tests/:id`
- Headers: `Authorization: Bearer <JWT>`
- Response (نمونه واقعی):
```json
{
  "id": 5,
  "patient_id": 1,
  "doctor_id": null,
  "image_path": "uploads/test_1761931406398_889267886.jpeg",
  "description": "تست نمایشی برای بررسی نتیجه ساختاریافته",
  "ai_result": "{\"schema_version\":\"1.0\",\"language\":\"fa-IR\",\"summary\":\"...\",\"severity\":\"low\",\"extracted_tags\":[\"آزمایش خون\",\"ویتامین D\"],\"potential_diagnoses\":[{\"name\":\"کمبود ویتامین D\",\"confidence\":0.7}],\"recommendations\":[\"مصرف مکمل ویتامین D\"],\"confidence\":0.7,\"reasoning\":\"...\",\"urgent\":false,\"raw_text\":\"...\",\"patient_context\":{\"age\":23,\"description\":\"...\"}}",
  "status": "urgent",
  "created_at": "2025-10-31T17:23:26.000Z"
}
```

نکته مهم: مقدار `ai_result` یک «رشتهٔ JSON» است؛ در فرانت‌اند باید با `JSON.parse(test.ai_result)` تبدیل به شیء شود.

## 🧠 ساختار استاندارد `ai_result`

برای پیاده‌سازی UI سازگار، پس از پارس رشتهٔ `ai_result`، انتظار می‌رود شیء با این کلیدها باشد:
- `summary`: خلاصه انسانی
- `severity`: `low | medium | high`
- `extracted_tags`: آرایهٔ برچسب‌ها
- `potential_diagnoses`: آرایهٔ تشخیص‌های احتمالی با کلیدهای `{ name, confidence (0..1), notes? }`
- `recommendations`: آرایهٔ توصیه‌ها
- `confidence`: اطمینان کلی (۰ تا ۱)
- `reasoning`: توضیح مدل
- `urgent`: بولین اضطرار
- اختیاری: `raw_text`, `patient_context`

سازگاری‌ها در فرانت‌اند:
- اگر `confidence` درصدی بود، به ۰..۱ نرمال‌سازی کن.
- اگر کلیدها نام متفاوت دارند (مثل `tags`)، به `extracted_tags` نگاشت کن.
- اگر پاسخ AI به‌صورت متن آزاد باشد، آن را به‌صورت خلاصه (`summary`) نمایش بده.

## 👨‍💼 مدیریت (ادمین)

### لیست تمام کاربران
- Endpoint: `GET /api/admin/users`
- Headers: `Authorization: Bearer <JWT>` + نقش `admin`
- Response (آرایهٔ کاربران):
```json
[
  { "id": 1, "phone": "0912...", "name": "...", "role": "patient", "is_verified": true, "created_at": "..." }
]
```

### تغییر نقش کاربر
- Endpoint: `PUT /api/admin/users/:id/role`
- Body: `{ "role": "patient|doctor|admin" }`
- Response:
```json
{ "id": 1, "phone": "0912...", "name": "...", "national_id": "...", "age": 30, "role": "doctor" }
```

### حذف کاربر
- Endpoint: `DELETE /api/admin/users/:id`
- Response:
```json
{ "success": true }
```

## 🖼️ دسترسی به فایل‌های آپلود
- Static: `GET /uploads/<filename>`
- مثال: `http://localhost:8889/uploads/test_1761931406398_889267886.jpeg`

## 🔄 الگوهای درخواست (نمونه‌های عملی)

### آپلود تست
```bash
curl -X POST "http://localhost:8889/api/tests/upload" \
  -H "Authorization: Bearer <JWT>" \
  -F "image=@/absolute/path/to/test.jpeg" \
  -F "description=توضیح کاربر"
```

### لیست تست‌ها
```bash
curl "http://localhost:8889/api/tests" -H "Authorization: Bearer <JWT>"
```

### جزئیات تست
```bash
curl "http://localhost:8889/api/tests/5" -H "Authorization: Bearer <JWT>"
```
خروجی نمونه:
```json
{
  "id": 5,
  "patient_id": 1,
  "doctor_id": null,
  "image_path": "uploads/test_1761931406398_889267886.jpeg",
  "description": "تست نمایشی برای بررسی نتیجه ساختاریافته",
  "ai_result": "{\"schema_version\":\"1.0\",\"language\":\"fa-IR\",\"summary\":\"...\",\"severity\":\"low\",\"extracted_tags\":[\"آزمایش خون\",\"ویتامین D\"],\"potential_diagnoses\":[{\"name\":\"کمبود ویتامین D\",\"confidence\":0.7}],\"recommendations\":[\"مصرف مکمل ویتامین D\"],\"confidence\":0.7,\"reasoning\":\"...\",\"urgent\":false,\"raw_text\":\"...\",\"patient_context\":{\"age\":23,\"description\":\"...\"}}",
  "status": "urgent",
  "created_at": "2025-10-31T17:23:26.000Z"
}
```

## 🛡️ نمونه محافظت Route در فرانت‌اند

```javascript
import { Navigate } from 'react-router-dom';

export const ProtectedRoute = ({ children }) => {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (getTokenType() === 'temporary') return <Navigate to="/complete-profile" replace />;
  return children;
};
```

## ⚠️ مدیریت خطا
- 401: توکن ارائه نشده/نامعتبر
- 403: دسترسی غیرمجاز
- 404: رکورد یافت نشد
- 400: ورودی نامعتبر
- 500: خطای داخلی/AI

## ✅ نکات پیاده‌سازی UI
- در لیست تست‌ها از `id`, `description`, `status`, `created_at`, `image_path` استفاده کن.
- در جزئیات تست، `ai_result` را پارس کن و مطابق اسکیمای فوق رندر کن.
- در صورت نیاز به پیش‌نمایش خلاصه در لیست، می‌توانیم فیلد `ai_summary` را به پاسخ لیست اضافه کنیم.

---
این مستند مطابق پیاده‌سازی فعلی سرویس شما نوشته شده و نمونه پاسخ‌ها از خروجی‌های واقعی استخراج شده‌اند تا فرانت‌اند دقیقاً بر اساس آن توسعه یابد.
