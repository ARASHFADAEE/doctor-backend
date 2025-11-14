# Changelog

تمام تغییرات مهم این پروژه در این فایل مستند می‌شود.

## [1.1.0] - 2025-11-14

### افزوده شده ✨

#### سیستم صف و نوبت‌دهی هوشمند
- **جداول دیتابیس جدید:**
  - `doctor_settings` - تنظیمات پزشکان برای مدیریت صف
  - `doctor_queues` - صف‌های روزانه هر پزشک
  - `queue_items` - آیتم‌های صف (بیماران در انتظار)
  - `queue_events` - لاگ و audit تمام رویدادها
  - `appointments` - مدیریت نوبت‌ها
  - `visit_durations` - ذخیره مدت زمان ویزیت‌ها برای آنالیز
  - `rooms` - مدیریت اتاق‌های ویزیت (اختیاری)

- **API Endpoints:**
  - `POST /api/queues/:doctorId/date/:date` - ایجاد یا دریافت صف
  - `GET /api/queues/:doctorId/date/:date` - دریافت صف با تمام آیتم‌ها
  - `POST /api/queues/:queueId/enqueue` - اضافه کردن بیمار به صف
  - `POST /api/queue-items/:id/start` - شروع ویزیت
  - `POST /api/queue-items/:id/end` - پایان ویزیت
  - `POST /api/queue-items/:id/extend` - افزایش زمان ویزیت
  - `POST /api/queues/:queueId/position` - تغییر موقعیت در صف
  - `GET /api/doctors/:id/settings` - دریافت تنظیمات پزشک
  - `PUT /api/doctors/:id/settings` - به‌روزرسانی تنظیمات
  - `GET /api/doctor/:id/queue/today` - دریافت صف امروز

- **WebSocket Support:**
  - پشتیبانی کامل از Socket.IO برای به‌روزرسانی‌های Real-time
  - رویدادها: `queue.update`, `queue.item.started`, `queue.item.ended`, `queue.estimated_change`
  - اتاق‌های مجزا برای هر صف، پزشک و بیمار
  - احراز هویت JWT برای WebSocket

- **الگوریتم محاسبه زمان:**
  - محاسبه هوشمند مدت زمان پیش‌بینی شده با weighted average
  - استفاده از داده‌های تاریخی بیمار و پزشک
  - بازمحاسبه خودکار زمان‌های تخمینی (ETA) پس از هر تغییر
  - پشتیبانی از buffer قبل و بعد از هر ویزیت

- **Background Workers:**
  - `recalculateQueue.worker.js` - بازمحاسبه debounced صف
  - `noShowCheck.worker.js` - بررسی خودکار no-show هر 5 دقیقه

- **Concurrency Control:**
  - استفاده از `SELECT ... FOR UPDATE` برای جلوگیری از race condition
  - تضمین unique بودن position در صف
  - Transaction-safe operations

- **تست‌ها:**
  - Unit tests برای queue service
  - Integration tests برای API endpoints
  - Concurrency tests (20 همزمان enqueue)
  - Test coverage برای الگوریتم‌های محاسباتی

- **مستندات:**
  - `docs/QUEUE_SYSTEM.md` - مستندات کامل سیستم صف
  - `README.md` - راهنمای نصب و استفاده
  - `examples/queue-client.js` - مثال‌های کاربردی
  - Postman collection برای تست API ها

### تغییر یافته 🔄

- **server.js:**
  - اضافه شدن Socket.IO server
  - راه‌اندازی background workers
  - تغییر از `app.listen` به `server.listen`

- **src/db.js:**
  - اضافه شدن جداول جدید به `initDB()`
  - پشتیبانی از charset utf8mb4

- **package.json:**
  - اضافه شدن `socket.io` به dependencies
  - اضافه شدن `jest` و `supertest` به devDependencies
  - اضافه شدن npm scripts برای تست

### امنیت 🔒

- Role-based access control برای تمام queue endpoints
- JWT authentication برای WebSocket connections
- Audit logging تمام عملیات در `queue_events`
- Input validation برای تمام API endpoints

### بهینه‌سازی ⚡

- Debounced recalculation برای کاهش بار دیتابیس
- Indexed queries برای عملکرد بهتر
- Connection pooling برای MySQL
- Efficient ETA calculation algorithm

## [1.0.0] - قبل از این

### ویژگی‌های اولیه
- احراز هویت با JWT و OTP
- مدیریت کاربران (بیمار، پزشک، ادمین)
- مدیریت تست‌های پزشکی
- تحلیل هوش مصنوعی تصاویر
- ارسال پیامک با Kavenegar
- آپلود و مدیریت فایل‌ها

---

## نحوه نگارش Changelog

فرمت بر اساس [Keep a Changelog](https://keepachangelog.com/fa/1.0.0/)

### انواع تغییرات:
- `افزوده شده` - ویژگی‌های جدید
- `تغییر یافته` - تغییرات در ویژگی‌های موجود
- `منسوخ شده` - ویژگی‌هایی که به زودی حذف می‌شوند
- `حذف شده` - ویژگی‌های حذف شده
- `رفع شده` - رفع باگ‌ها
- `امنیت` - در مورد آسیب‌پذیری‌ها
