# راهنمای شروع سریع - سیستم صف هوشمند

این راهنما برای راه‌اندازی سریع سیستم صف و نوبت‌دهی است.

## نصب در 5 دقیقه ⚡

### 1. نصب وابستگی‌ها

```bash
npm install
```

### 2. تنظیم دیتابیس

```bash
# ایجاد دیتابیس
mysql -u root -p
CREATE DATABASE medai_vision CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;
```

### 3. تنظیم Environment Variables

```bash
cp .env.example .env
# ویرایش .env و تنظیم:
# - DB_HOST, DB_USER, DB_PASS, DB_NAME
# - JWT_SECRET
```

### 4. اجرای سرور

```bash
npm start
```

جداول به صورت خودکار ایجاد می‌شوند! ✨

### 5. ایجاد داده‌های تستی (اختیاری)

```bash
npm run seed
```

این دستور:
- 1 پزشک تستی
- 5 بیمار تستی
- 1 صف امروز با 5 بیمار
- داده‌های تاریخی برای آنالیز

ایجاد می‌کند.

## تست سریع API

### دریافت صف امروز

```bash
# ابتدا توکن JWT دریافت کنید (از endpoint login)
export TOKEN="your_jwt_token"

# دریافت صف
curl http://localhost:5000/api/doctor/1/queue/today \
  -H "Authorization: Bearer $TOKEN"
```

### اضافه کردن بیمار به صف

```bash
# ابتدا queue_id را از response قبلی بگیرید
curl -X POST http://localhost:5000/api/queues/1/enqueue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patient_id": 5, "expected_duration_minutes": 10}'
```

### شروع ویزیت

```bash
# queue_item_id را از response قبلی بگیرید
curl -X POST http://localhost:5000/api/queue-items/1/start \
  -H "Authorization: Bearer $TOKEN"
```

## تست WebSocket

### با JavaScript

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:5000', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('connect', () => {
  console.log('Connected!');
  socket.emit('join:queue', { queueId: 1 });
});

socket.on('queue.update', (data) => {
  console.log('Queue updated:', data);
});
```

### با Postman

1. New Request → WebSocket Request
2. URL: `ws://localhost:5000`
3. Headers: `Authorization: Bearer YOUR_TOKEN`
4. Send: `{"event": "join:queue", "data": {"queueId": 1}}`

## استفاده از Postman Collection

1. Import کنید: `postman/Queue_API.postman_collection.json`
2. Variables را تنظیم کنید:
   - `base_url`: `http://localhost:5000/api`
   - `token`: JWT token خود
   - `doctor_id`: 1
3. شروع به تست کنید!

## مثال کامل با Node.js

```javascript
const { completeScenario } = require('./examples/queue-client');

// اجرای سناریوی کامل
completeScenario();
```

این سناریو:
1. صف امروز را می‌گیرد
2. WebSocket را راه‌اندازی می‌کند
3. 3 بیمار اضافه می‌کند
4. ویزیت اول را شروع می‌کند
5. زمان را extend می‌کند
6. ویزیت را تمام می‌کند

## اجرای تست‌ها

```bash
# تمام تست‌ها
npm test

# فقط unit tests
npx jest tests/queue.service.test.js

# فقط integration tests
npx jest tests/queue.integration.test.js

# با coverage
npm run test:coverage
```

## دستورات مفید

```bash
# اجرا در حالت development (با hot reload)
npm run dev

# seed داده‌های تستی
npm run seed

# پاک کردن داده‌های تستی
npm run clean

# مشاهده لاگ‌ها
tail -f logs/app.log  # اگر logging فعال باشد
```

## ساختار پروژه (فایل‌های مهم)

```
back-end/
├── src/
│   ├── controllers/queue.controller.js  ← کنترلر API
│   ├── services/queue.service.js        ← Business logic
│   ├── routes/queue.js                  ← Routes
│   ├── sockets/queue.socket.js          ← WebSocket
│   └── workers/                         ← Background jobs
├── tests/                               ← تست‌ها
├── docs/QUEUE_SYSTEM.md                 ← مستندات کامل
├── examples/queue-client.js             ← مثال‌ها
└── migrations/001_queue_system.sql      ← Schema
```

## مشکلات رایج

### خطای اتصال به دیتابیس

```bash
# بررسی کنید MySQL در حال اجراست
mysql -u root -p

# بررسی .env
cat .env | grep DB_
```

### خطای JWT

```bash
# مطمئن شوید JWT_SECRET تنظیم شده
echo $JWT_SECRET

# یا در .env
grep JWT_SECRET .env
```

### Socket.IO متصل نمی‌شود

- مطمئن شوید token معتبر است
- CORS_ORIGIN را بررسی کنید
- از browser console خطاها را ببینید

## مرحله بعدی

- 📖 مستندات کامل: [`docs/QUEUE_SYSTEM.md`](docs/QUEUE_SYSTEM.md)
- 📝 مثال‌های بیشتر: [`examples/queue-client.js`](examples/queue-client.js)
- 🧪 تست‌ها: [`tests/`](tests/)
- 📮 Postman: [`postman/`](postman/)

## پشتیبانی

مشکل دارید؟
1. مستندات را بخوانید
2. لاگ‌ها را بررسی کنید
3. Issue باز کنید

---

**موفق باشید! 🚀**
