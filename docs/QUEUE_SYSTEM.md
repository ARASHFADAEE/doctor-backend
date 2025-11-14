# سیستم صف و نوبت‌دهی هوشمند

## معرفی

این ماژول یک سیستم صف و نوبت‌دهی هوشمند برای مدیریت صف بیماران پزشکان است که شامل:

- محاسبه زمان تخمینی انتظار بر اساس میانگین تاریخی
- نوبت‌دهی بازه‌ای برای جلوگیری از تجمع بیماران
- تایمر واقعی و اعلان‌های لحظه‌ای
- WebSocket برای به‌روزرسانی زنده
- آنالیز و لاگ تاریخی

## نصب و راه‌اندازی

### 1. نصب وابستگی‌ها

```bash
npm install socket.io
npm install --save-dev jest supertest
```

### 2. اجرای Migration

```bash
mysql -u root -p your_database < migrations/001_queue_system.sql
```

یا از طریق کد:
- جداول به صورت خودکار در `src/db.js` ایجاد می‌شوند

### 3. متغیرهای محیطی

در فایل `.env` خود موارد زیر را اضافه کنید:

```env
# Queue System
WORKER_ENABLED=true          # فعال‌سازی worker برای no-show check
CORS_ORIGIN=http://localhost:3000

# Existing vars
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=medai_vision
JWT_SECRET=your_secret_key
PORT=5000
```

### 4. اجرای سرور

```bash
npm start
# یا برای development
npm run dev
```

## API Endpoints

### صف (Queue)

#### ایجاد یا دریافت صف

```bash
POST /api/queues/:doctorId/date/:date
Authorization: Bearer {token}

# مثال
curl -X POST http://localhost:5000/api/queues/1/date/2025-11-15 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**پاسخ:**
```json
{
  "success": true,
  "queue": {
    "id": 1,
    "doctor_id": 1,
    "date": "2025-11-15",
    "created_at": "2025-11-14T10:00:00.000Z"
  }
}
```

#### دریافت صف با آیتم‌ها

```bash
GET /api/queues/:doctorId/date/:date
Authorization: Bearer {token}

# مثال
curl http://localhost:5000/api/queues/1/date/2025-11-15 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**پاسخ:**
```json
{
  "success": true,
  "queue": {
    "id": 1,
    "doctor_id": 1,
    "date": "2025-11-15",
    "items": [
      {
        "id": 1,
        "position": 1,
        "patient_id": 5,
        "patient_name": "علی احمدی",
        "expected_duration_minutes": 8,
        "estimated_start_at": "2025-11-15T09:00:00.000Z",
        "estimated_end_at": "2025-11-15T09:08:00.000Z",
        "status": "waiting"
      }
    ]
  }
}
```

#### اضافه کردن بیمار به صف

```bash
POST /api/queues/:queueId/enqueue
Authorization: Bearer {token}
Content-Type: application/json

{
  "patient_id": 5,
  "appointment_id": 10,
  "expected_duration_minutes": 10
}

# مثال
curl -X POST http://localhost:5000/api/queues/1/enqueue \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patient_id": 5, "expected_duration_minutes": 10}'
```

**پاسخ:**
```json
{
  "success": true,
  "queue_item": {
    "id": 1,
    "queue_id": 1,
    "patient_id": 5,
    "position": 1,
    "expected_duration_minutes": 10,
    "status": "waiting"
  }
}
```

### عملیات روی آیتم صف

#### شروع ویزیت

```bash
POST /api/queue-items/:id/start
Authorization: Bearer {token}

# مثال
curl -X POST http://localhost:5000/api/queue-items/1/start \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### پایان ویزیت

```bash
POST /api/queue-items/:id/end
Authorization: Bearer {token}
Content-Type: application/json

{
  "actual_end_at": "2025-11-15T09:15:00.000Z"  // اختیاری
}

# مثال
curl -X POST http://localhost:5000/api/queue-items/1/end \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### افزایش زمان ویزیت

```bash
POST /api/queue-items/:id/extend
Authorization: Bearer {token}
Content-Type: application/json

{
  "extra_minutes": 5,
  "note": "نیاز به معاینه بیشتر"
}

# مثال
curl -X POST http://localhost:5000/api/queue-items/1/extend \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"extra_minutes": 5, "note": "نیاز به معاینه بیشتر"}'
```

#### تغییر موقعیت در صف

```bash
POST /api/queues/:queueId/position
Authorization: Bearer {token}
Content-Type: application/json

{
  "queue_item_id": 3,
  "new_position": 1
}

# مثال
curl -X POST http://localhost:5000/api/queues/1/position \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"queue_item_id": 3, "new_position": 1}'
```

### تنظیمات پزشک

#### دریافت تنظیمات

```bash
GET /api/doctors/:id/settings
Authorization: Bearer {token}

# مثال
curl http://localhost:5000/api/doctors/1/settings \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**پاسخ:**
```json
{
  "success": true,
  "settings": {
    "doctor_id": 1,
    "default_duration_minutes": 8,
    "buffer_before_minutes": 0,
    "buffer_after_minutes": 0,
    "allow_overflow": false
  }
}
```

#### به‌روزرسانی تنظیمات

```bash
PUT /api/doctors/:id/settings
Authorization: Bearer {token}
Content-Type: application/json

{
  "default_duration_minutes": 10,
  "buffer_after_minutes": 2,
  "allow_overflow": true
}

# مثال
curl -X PUT http://localhost:5000/api/doctors/1/settings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default_duration_minutes": 10, "buffer_after_minutes": 2}'
```

#### صف امروز پزشک

```bash
GET /api/doctor/:id/queue/today
Authorization: Bearer {token}

# مثال
curl http://localhost:5000/api/doctor/1/queue/today \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## WebSocket Events

### اتصال

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

socket.on('connect', () => {
  console.log('Connected to server');
});
```

### عضویت در اتاق‌ها

```javascript
// عضویت در صف
socket.emit('join:queue', { queueId: 1 });

socket.on('joined:queue', (data) => {
  console.log('Joined queue:', data.queueId);
});

// عضویت در اتاق پزشک
socket.emit('join:doctor', { doctorId: 1 });

// عضویت در اتاق بیمار
socket.emit('join:patient', { patientId: 5 });
```

### دریافت رویدادها

```javascript
// به‌روزرسانی صف
socket.on('queue.update', (data) => {
  console.log('Queue updated:', data.queueId);
  console.log('Items:', data.items);
  // به‌روزرسانی UI
});

// شروع ویزیت
socket.on('queue.item.started', (data) => {
  console.log('Visit started:', data.queueItemId);
});

// پایان ویزیت
socket.on('queue.item.ended', (data) => {
  console.log('Visit ended:', data.queueItemId);
  console.log('Duration:', data.actualDuration);
});

// تغییر زمان تخمینی
socket.on('queue.estimated_change', (data) => {
  console.log('ETAs changed for queue:', data.queueId);
  console.log('Affected items:', data.affected_items);
});

// تایمر (اختیاری)
socket.on('timer.tick', (data) => {
  console.log('Timer:', data.remainingSeconds);
});
```

## الگوریتم محاسبه زمان

### محاسبه مدت زمان پیش‌بینی شده

```
expected_duration = 
  0.5 × doctor_default_duration +
  0.3 × patient_historical_avg +
  0.2 × doctor_overall_avg
```

### محاسبه زمان شروع و پایان

```
برای آیتم اول:
  estimated_start = now

برای آیتم‌های بعدی:
  estimated_start = previous_item.estimated_end + buffer_after
  estimated_end = estimated_start + expected_duration
```

## Workers

### No-Show Checker

این worker هر 5 دقیقه اجرا می‌شود و بیمارانی که 15 دقیقه از زمان نوبتشان گذشته و هنوز check-in نکرده‌اند را به عنوان `no_show` علامت می‌زند.

برای غیرفعال کردن:
```env
WORKER_ENABLED=false
```

## تست‌ها

### اجرای تست‌ها

```bash
# نصب jest
npm install --save-dev jest supertest

# اجرای تست‌ها
npm test

# یا
npx jest tests/queue.service.test.js
npx jest tests/queue.integration.test.js
```

### تست‌های موجود

1. **Unit Tests** (`tests/queue.service.test.js`):
   - ایجاد صف
   - enqueue با position صحیح
   - محاسبه expected_duration
   - تست همزمانی (20 enqueue همزمان)
   - بررسی monotonic بودن ETAs

2. **Integration Tests** (`tests/queue.integration.test.js`):
   - تست تمام API endpoints
   - Flow کامل: enqueue → start → extend → end
   - تست authentication و authorization

## امنیت

- تمام endpoints نیاز به JWT token دارند
- فقط `doctor` و `admin` می‌توانند صف را مدیریت کنند
- Socket.IO نیاز به authentication دارد
- تمام عملیات در queue_events لاگ می‌شوند

## مثال سناریو کامل

```javascript
// 1. ایجاد صف برای امروز
const queueRes = await fetch('/api/queues/1/date/2025-11-15', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer TOKEN' }
});
const { queue } = await queueRes.json();

// 2. اضافه کردن بیمار
const enqueueRes = await fetch(`/api/queues/${queue.id}/enqueue`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    patient_id: 5,
    expected_duration_minutes: 10
  })
});
const { queue_item } = await enqueueRes.json();

// 3. شروع ویزیت
await fetch(`/api/queue-items/${queue_item.id}/start`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer TOKEN' }
});

// 4. افزایش زمان (در صورت نیاز)
await fetch(`/api/queue-items/${queue_item.id}/extend`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    extra_minutes: 5,
    note: 'معاینه پیچیده‌تر از حد انتظار'
  })
});

// 5. پایان ویزیت
await fetch(`/api/queue-items/${queue_item.id}/end`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer TOKEN' }
});
```

## نکات مهم

1. **Concurrency**: از `SELECT ... FOR UPDATE` برای جلوگیری از race condition استفاده می‌شود
2. **Real-time**: تمام تغییرات از طریق Socket.IO منتشر می‌شوند
3. **Analytics**: تمام duration‌ها در `visit_durations` ذخیره می‌شوند
4. **Audit**: تمام رویدادها در `queue_events` لاگ می‌شوند
5. **Scalability**: برای چند instance از Redis adapter برای Socket.IO استفاده کنید

## توسعه آینده

- [ ] پشتیبانی از Redis برای worker queue (BullMQ)
- [ ] ارسال SMS/Push notification برای تغییرات ETA
- [ ] داشبورد آنالیتیکس
- [ ] پیش‌بینی هوشمند‌تر با ML
- [ ] پشتیبانی از چند اتاق همزمان
