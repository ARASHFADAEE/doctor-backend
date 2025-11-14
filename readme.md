# MedAI Vision Backend - سیستم صف و نوبت‌دهی هوشمند

Backend سیستم MedAI Vision با قابلیت مدیریت صف و نوبت‌دهی هوشمند برای کلینیک‌ها و مطب‌های پزشکی.

## ویژگی‌های اصلی

### سیستم صف هوشمند ✨
- 📊 محاسبه زمان انتظار بر اساس داده‌های تاریخی
- ⏱️ تایمر واقعی و اعلان‌های لحظه‌ای
- 🔄 به‌روزرسانی خودکار زمان‌های تخمینی
- 📱 WebSocket برای ارتباط Real-time
- 📈 آنالیز و گزارش‌گیری پیشرفته

### سایر قابلیت‌ها
- 🔐 احراز هویت با JWT
- 👥 مدیریت کاربران (بیمار، پزشک، ادمین)
- 🧪 مدیریت تست‌های پزشکی
- 🤖 تحلیل هوش مصنوعی تصاویر پزشکی
- 📧 ارسال پیامک با Kavenegar

## نصب و راه‌اندازی

### پیش‌نیازها

- Node.js >= 16
- MySQL >= 8.0
- npm یا yarn

### مراحل نصب

1. **کلون کردن پروژه**

```bash
git clone <repository-url>
cd back-end
```

2. **نصب وابستگی‌ها**

```bash
npm install
```

3. **تنظیم متغیرهای محیطی**

```bash
cp .env.example .env
# ویرایش فایل .env و تنظیم مقادیر
```

4. **ایجاد دیتابیس**

```bash
mysql -u root -p
CREATE DATABASE medai_vision CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

5. **اجرای Migration (اختیاری)**

جداول به صورت خودکار در اولین اجرا ایجاد می‌شوند، اما می‌توانید migration را دستی اجرا کنید:

```bash
mysql -u root -p medai_vision < migrations/001_queue_system.sql
```

6. **اجرای سرور**

```bash
# حالت production
npm start

# حالت development (با hot reload)
npm run dev
```

سرور روی `http://localhost:5000` اجرا می‌شود.

## ساختار پروژه

```
back-end/
├── src/
│   ├── controllers/       # کنترلرهای API
│   │   └── queue.controller.js
│   ├── routes/           # مسیرهای API
│   │   └── queue.js
│   ├── services/         # لایه Business Logic
│   │   └── queue.service.js
│   ├── sockets/          # WebSocket handlers
│   │   └── queue.socket.js
│   ├── workers/          # Background jobs
│   │   ├── recalculateQueue.worker.js
│   │   └── noShowCheck.worker.js
│   ├── middleware/       # Middleware ها
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── models/           # مدل‌های دیتابیس
│   └── db.js            # تنظیمات دیتابیس
├── tests/               # تست‌ها
│   ├── queue.service.test.js
│   ├── queue.integration.test.js
│   └── setup.js
├── migrations/          # SQL migrations
│   └── 001_queue_system.sql
├── docs/               # مستندات
│   └── QUEUE_SYSTEM.md
├── examples/           # مثال‌های استفاده
│   └── queue-client.js
├── uploads/            # فایل‌های آپلود شده
├── server.js           # Entry point
├── package.json
└── .env.example
```

## 📚 API Documentation

### Swagger UI (توصیه می‌شود)

مستندات کامل و تعاملی API در آدرس زیر:

**🔗 http://localhost:8889/api-docs**

در Swagger UI می‌توانید:
- ✅ تمام endpoint ها را مشاهده کنید
- ✅ مستقیماً API را تست کنید  
- ✅ نمونه request/response ببینید
- ✅ Schema های داده را بررسی کنید

راهنمای کامل: [`docs/SWAGGER_GUIDE.md`](docs/SWAGGER_GUIDE.md)

### Authentication

تمام endpoint های محافظت شده نیاز به header زیر دارند:

```
Authorization: Bearer {JWT_TOKEN}
```

### Queue Endpoints

مستندات کامل در [`docs/QUEUE_SYSTEM.md`](docs/QUEUE_SYSTEM.md)

**خلاصه endpoint ها:**

- `POST /api/queues/:doctorId/date/:date` - ایجاد/دریافت صف
- `GET /api/queues/:doctorId/date/:date` - دریافت صف با آیتم‌ها
- `POST /api/queues/:queueId/enqueue` - اضافه کردن بیمار
- `POST /api/queue-items/:id/start` - شروع ویزیت
- `POST /api/queue-items/:id/end` - پایان ویزیت
- `POST /api/queue-items/:id/extend` - افزایش زمان
- `POST /api/queues/:queueId/position` - تغییر موقعیت
- `GET /api/doctors/:id/settings` - دریافت تنظیمات
- `PUT /api/doctors/:id/settings` - به‌روزرسانی تنظیمات
- `GET /api/doctor/:id/queue/today` - صف امروز

### WebSocket Events

```javascript
// اتصال
const socket = io('http://localhost:5000', {
  auth: { token: 'JWT_TOKEN' }
});

// عضویت در صف
socket.emit('join:queue', { queueId: 1 });

// دریافت به‌روزرسانی‌ها
socket.on('queue.update', (data) => { /* ... */ });
socket.on('queue.item.started', (data) => { /* ... */ });
socket.on('queue.item.ended', (data) => { /* ... */ });
```

## تست‌ها

### اجرای تست‌ها

```bash
# اجرای تمام تست‌ها
npm test

# اجرای تست‌ها با watch mode
npm run test:watch

# گزارش coverage
npm run test:coverage
```

### تست‌های موجود

- ✅ Unit tests برای queue service
- ✅ Integration tests برای API endpoints
- ✅ Concurrency tests (20 همزمان enqueue)
- ✅ ETA calculation tests

## Workers

### No-Show Checker

Worker ای که هر 5 دقیقه بیماران no-show را بررسی می‌کند.

برای غیرفعال کردن:
```env
WORKER_ENABLED=false
```

## امنیت

- 🔒 JWT authentication
- 🛡️ Helmet.js برای امنیت headers
- 🚦 Rate limiting
- ✅ Input validation با express-validator
- 🔐 Role-based access control
- 📝 Audit logging

## مثال استفاده

```javascript
// مثال کامل در examples/queue-client.js

const { completeScenario } = require('./examples/queue-client');

// اجرای سناریوی کامل
completeScenario();
```

## دیتابیس

### جداول اصلی سیستم صف

- `doctor_settings` - تنظیمات پزشکان
- `doctor_queues` - صف‌های روزانه
- `queue_items` - آیتم‌های صف (بیماران)
- `queue_events` - لاگ رویدادها
- `appointments` - نوبت‌ها
- `visit_durations` - مدت زمان ویزیت‌ها (برای آنالیز)
- `rooms` - اتاق‌های ویزیت (اختیاری)

### Schema

مشاهده schema کامل در [`migrations/001_queue_system.sql`](migrations/001_queue_system.sql)

## الگوریتم محاسبه زمان

```
expected_duration = 
  0.5 × doctor_default_duration +
  0.3 × patient_historical_avg +
  0.2 × doctor_overall_avg

estimated_start[i] = estimated_end[i-1] + buffer_after
estimated_end[i] = estimated_start[i] + expected_duration[i]
```

## Environment Variables

متغیرهای مهم:

```env
DB_HOST=localhost
DB_USER=root
DB_PASS=password
DB_NAME=medai_vision
PORT=5000
JWT_SECRET=your_secret
CORS_ORIGIN=http://localhost:3000
WORKER_ENABLED=true
```

## Deployment

### Production Checklist

- [ ] تغییر `JWT_SECRET` به مقدار امن
- [ ] تنظیم `NODE_ENV=production`
- [ ] فعال‌سازی HTTPS
- [ ] تنظیم `CORS_ORIGIN` به دامنه واقعی
- [ ] بررسی connection pool دیتابیس
- [ ] راه‌اندازی Redis برای Socket.IO (multi-instance)
- [ ] تنظیم backup خودکار دیتابیس
- [ ] فعال‌سازی monitoring و logging

### Docker (اختیاری)

```dockerfile
# Dockerfile نمونه
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## مشارکت

برای مشارکت در پروژه:

1. Fork کنید
2. Branch جدید بسازید (`git checkout -b feature/amazing-feature`)
3. تغییرات را commit کنید (`git commit -m 'Add amazing feature'`)
4. Push کنید (`git push origin feature/amazing-feature`)
5. Pull Request باز کنید

## لایسنس

ISC

## پشتیبانی

برای سوالات و مشکلات:
- Issue باز کنید
- مستندات را مطالعه کنید: [`docs/QUEUE_SYSTEM.md`](docs/QUEUE_SYSTEM.md)

---

**ساخته شده با ❤️ برای بهبود سیستم‌های پزشکی**
