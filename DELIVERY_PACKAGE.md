# 📦 بسته تحویل به تیم فرانت‌اند

## 🎯 خلاصه

سیستم صف و نوبت‌دهی هوشمند با موفقیت پیاده‌سازی و آماده استفاده است.

## 🔗 لینک‌های مهم

### مستندات API (اولویت اول)
**Swagger UI - مستندات تعاملی:**
```
http://localhost:8889/api-docs
```

در این صفحه می‌توانید:
- ✅ تمام API ها را ببینید
- ✅ مستقیماً تست کنید
- ✅ نمونه request/response مشاهده کنید
- ✅ توکن JWT را Authorize کنید

### راهنماهای کامل
1. **[FRONTEND_DEVELOPER_GUIDE.md](FRONTEND_DEVELOPER_GUIDE.md)** ⭐
   - شروع سریع در 3 مرحله
   - نمونه کدهای React
   - تنظیمات پایه

2. **[FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md)**
   - تمام API ها با جزئیات
   - نمونه request/response واقعی
   - WebSocket events

3. **[docs/SWAGGER_GUIDE.md](docs/SWAGGER_GUIDE.md)**
   - نحوه استفاده از Swagger
   - تست API ها
   - Export به Postman

## 📋 API های جدید (سیستم صف)

### Endpoints اصلی
```
POST   /api/queues/:doctorId/date/:date    # ایجاد/دریافت صف
GET    /api/queues/:doctorId/date/:date    # دریافت صف با آیتم‌ها
POST   /api/queues/:queueId/enqueue        # اضافه کردن بیمار
POST   /api/queue-items/:id/start          # شروع ویزیت
POST   /api/queue-items/:id/end            # پایان ویزیت
POST   /api/queue-items/:id/extend         # افزایش زمان
POST   /api/queues/:queueId/position       # تغییر موقعیت
GET    /api/doctors/:id/settings           # تنظیمات پزشک
PUT    /api/doctors/:id/settings           # به‌روزرسانی تنظیمات
GET    /api/doctor/:id/queue/today         # صف امروز (راحتی)
```

### WebSocket Events
```javascript
// اتصال
socket.emit('join:queue', { queueId: 1 });

// رویدادها
socket.on('queue.update', (data) => { /* صف به‌روزرسانی شد */ });
socket.on('queue.item.started', (data) => { /* ویزیت شروع شد */ });
socket.on('queue.item.ended', (data) => { /* ویزیت پایان یافت */ });
socket.on('queue.estimated_change', (data) => { /* زمان‌ها تغییر کرد */ });
```

## 🚀 شروع سریع

### 1. تنظیمات پایه
```javascript
// config.js
export const API_BASE_URL = 'http://localhost:8889/api';
export const SOCKET_URL = 'http://localhost:8889';

export const getToken = () => localStorage.getItem('auth_token');
```

### 2. نمونه درخواست
```javascript
// دریافت صف امروز
const response = await fetch(
  `${API_BASE_URL}/doctor/1/queue/today`,
  {
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  }
);

const data = await response.json();
console.log(data.queue.items); // لیست بیماران
```

### 3. WebSocket
```javascript
import io from 'socket.io-client';

const socket = io(SOCKET_URL, {
  auth: { token: getToken() }
});

socket.on('queue.update', (data) => {
  console.log('Queue updated:', data.items);
  // به‌روزرسانی UI
});
```

## 📦 فایل‌های مفید

### Postman Collection
```
postman/Queue_API.postman_collection.json
```
Import کنید و تمام API ها را تست کنید.

### نمونه کدها
```
examples/queue-client.js
```
مثال‌های کامل استفاده از API و WebSocket

## 🎨 UI/UX پیشنهادی

### وضعیت‌های صف
```javascript
const statusColors = {
  waiting: '#fef3c7',      // زرد - در انتظار
  in_progress: '#dbeafe',  // آبی - در حال ویزیت
  done: '#d1fae5',         // سبز - تکمیل شده
  skipped: '#fee2e2',      // قرمز - رد شده
  cancelled: '#f3f4f6'     // خاکستری - لغو شده
};
```

### نمایش زمان
```javascript
// زمان تخمینی شروع
const startTime = new Date(item.estimated_start_at)
  .toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit'
  });

// زمان باقیمانده
const remaining = Math.floor(
  (new Date(item.estimated_start_at) - new Date()) / 60000
);
const remainingText = remaining < 0 
  ? 'اکنون' 
  : `${remaining} دقیقه`;
```

## 🔐 احراز هویت

تمام endpoint های محافظت شده نیاز به header زیر دارند:
```
Authorization: Bearer {JWT_TOKEN}
```

برای دریافت توکن:
```javascript
// 1. ارسال OTP
POST /api/auth/send-otp
Body: { "phone": "09121234567" }

// 2. تأیید OTP
POST /api/auth/verify-otp
Body: { "phone": "09121234567", "code": "123456" }

// Response
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

## 📊 ساختار داده‌ها

### Queue Item
```typescript
interface QueueItem {
  id: number;
  queue_id: number;
  patient_id: number;
  patient_name: string;
  patient_phone: string;
  position: number;
  expected_duration_minutes: number;
  estimated_start_at: string; // ISO 8601
  estimated_end_at: string;   // ISO 8601
  status: 'waiting' | 'in_progress' | 'done' | 'skipped' | 'cancelled';
  created_at: string;
}
```

### Queue
```typescript
interface Queue {
  id: number;
  doctor_id: number;
  date: string; // YYYY-MM-DD
  items: QueueItem[];
}
```

## ⚠️ نکات مهم

### 1. Real-time Updates
همیشه از WebSocket برای به‌روزرسانی UI استفاده کنید. بعد از هر action (start/end/extend)، UI از طریق socket به‌روزرسانی می‌شود.

### 2. Error Handling
```javascript
try {
  const data = await apiRequest('/endpoint');
} catch (error) {
  if (error.message.includes('توکن')) {
    // هدایت به لاگین
    navigate('/login');
  } else {
    showNotification(error.message, 'error');
  }
}
```

### 3. Optimistic UI
برای تجربه کاربری بهتر، UI را فوراً به‌روزرسانی کنید (قبل از دریافت پاسخ):
```javascript
// فوراً UI را تغییر بده
setQueue(prev => updateStatus(prev, itemId, 'in_progress'));

// سپس درخواست بفرست
await apiRequest(`/queue-items/${itemId}/start`, { method: 'POST' });
```

### 4. WebSocket Reconnection
```javascript
socket.on('disconnect', () => {
  console.log('Disconnected, reconnecting...');
  setTimeout(() => socket.connect(), 1000);
});
```

## 🧪 تست

### تست در Swagger
1. برو به `http://localhost:8889/api-docs`
2. Authorize کن (دکمه قفل سبز)
3. توکن را وارد کن: `Bearer YOUR_TOKEN`
4. Try it out و Execute

### تست با Postman
1. Import کن: `postman/Queue_API.postman_collection.json`
2. Variables را تنظیم کن
3. تست کن

## 📞 پشتیبانی

### سوالات متداول
**Q: چطور توکن بگیرم؟**
A: از endpoint های `/auth/send-otp` و `/auth/verify-otp` استفاده کنید.

**Q: WebSocket متصل نمی‌شود؟**
A: مطمئن شوید توکن معتبر است و در `auth` ارسال شده.

**Q: زمان‌های تخمینی چطور محاسبه می‌شوند؟**
A: بر اساس میانگین وزنی: 50% تنظیمات پزشک + 30% تاریخچه بیمار + 20% میانگین کلی پزشک

**Q: چطور صف را real-time به‌روزرسانی کنم؟**
A: از WebSocket استفاده کنید و به event `queue.update` گوش دهید.

### مستندات بیشتر
- Swagger: `http://localhost:8889/api-docs`
- راهنمای سریع: `FRONTEND_DEVELOPER_GUIDE.md`
- مستندات کامل: `FRONTEND_INTEGRATION.md`
- سیستم صف: `docs/QUEUE_SYSTEM.md`

## ✅ Checklist پیاده‌سازی

برای پیاده‌سازی کامل در فرانت‌اند:

### صفحات مورد نیاز
- [ ] صفحه لاگین (OTP)
- [ ] داشبورد پزشک
- [ ] صفحه صف (Queue Management)
- [ ] صفحه تنظیمات پزشک

### Component های پیشنهادی
- [ ] `QueueList` - نمایش لیست بیماران
- [ ] `QueueItem` - هر بیمار در صف
- [ ] `QueueTimer` - تایمر شمارش معکوس
- [ ] `QueueActions` - دکمه‌های start/end/extend
- [ ] `QueueSettings` - تنظیمات پزشک

### قابلیت‌ها
- [ ] نمایش صف امروز
- [ ] اضافه کردن بیمار به صف
- [ ] شروع ویزیت
- [ ] پایان ویزیت
- [ ] افزایش زمان ویزیت
- [ ] تغییر موقعیت (drag & drop)
- [ ] نمایش زمان تخمینی
- [ ] نوتیفیکیشن‌ها
- [ ] به‌روزرسانی real-time

## 🎉 آماده برای شروع!

تمام چیزی که نیاز دارید در مستندات موجود است. موفق باشید!

---

**تاریخ تحویل**: 2025-11-14
**نسخه**: 1.1.0
**وضعیت**: ✅ Production Ready
