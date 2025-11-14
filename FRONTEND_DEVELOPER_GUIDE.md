# 🚀 راهنمای سریع برای فرانت‌اند دولوپر

## شروع سریع در 3 مرحله

### 1️⃣ دسترسی به مستندات

**Swagger UI (توصیه می‌شود):**
```
http://localhost:8889/api-docs
```

**مستندات کامل:**
- [`FRONTEND_INTEGRATION.md`](FRONTEND_INTEGRATION.md) - تمام API ها با مثال
- [`docs/SWAGGER_GUIDE.md`](docs/SWAGGER_GUIDE.md) - راهنمای Swagger
- [`docs/QUEUE_SYSTEM.md`](docs/QUEUE_SYSTEM.md) - سیستم صف

### 2️⃣ تنظیمات پایه

```javascript
// config.js
export const API_BASE_URL = 'http://localhost:8889/api';
export const SOCKET_URL = 'http://localhost:8889';

export const getToken = () => localStorage.getItem('auth_token');

export const apiRequest = async (endpoint, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...options.headers
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'خطا در درخواست');
  }
  
  return response.json();
};
```

### 3️⃣ مثال استفاده

```javascript
// Login
const login = async (phone, code) => {
  const data = await apiRequest('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, code })
  });
  
  localStorage.setItem('auth_token', data.token);
  return data;
};

// Get Queue
const getQueue = async (doctorId, date) => {
  return apiRequest(`/queues/${doctorId}/date/${date}`);
};

// WebSocket
import io from 'socket.io-client';

const socket = io(SOCKET_URL, {
  auth: { token: getToken() }
});

socket.on('queue.update', (data) => {
  console.log('Queue updated:', data);
});
```

## 📋 API های اصلی

### احراز هویت
```javascript
POST /auth/send-otp          // ارسال کد
POST /auth/verify-otp        // تأیید کد
POST /auth/complete-profile  // تکمیل پروفایل
```

### کاربر
```javascript
GET  /users/me              // پروفایل من
PUT  /users/me              // به‌روزرسانی پروفایل
```

### تست‌های پزشکی
```javascript
POST /tests/upload          // آپلود تست (FormData)
GET  /tests                 // لیست تست‌ها
GET  /tests/:id             // جزئیات تست
```

### صف (جدید ✨)
```javascript
POST /queues/:doctorId/date/:date    // ایجاد صف
GET  /queues/:doctorId/date/:date    // دریافت صف
POST /queues/:queueId/enqueue        // اضافه کردن بیمار
POST /queue-items/:id/start          // شروع ویزیت
POST /queue-items/:id/end            // پایان ویزیت
POST /queue-items/:id/extend         // افزایش زمان
GET  /doctor/:id/queue/today         // صف امروز
```

### مدیریت (Admin)
```javascript
GET    /admin/users              // لیست کاربران
POST   /admin/users              // ایجاد کاربر
PUT    /admin/users/:id/role     // تغییر نقش
DELETE /admin/users/:id          // حذف کاربر
GET    /admin/stats/overview     // آمار کلی
GET    /admin/tests              // مدیریت تست‌ها
```

## 🔌 WebSocket Events

```javascript
// اتصال
socket.emit('join:queue', { queueId: 1 });
socket.emit('join:doctor', { doctorId: 1 });
socket.emit('join:patient', { patientId: 5 });

// رویدادها
socket.on('queue.update', (data) => {
  // صف به‌روزرسانی شد
});

socket.on('queue.item.started', (data) => {
  // ویزیت شروع شد
});

socket.on('queue.item.ended', (data) => {
  // ویزیت پایان یافت
});

socket.on('queue.estimated_change', (data) => {
  // زمان‌های تخمینی تغییر کرد
});
```

## 📦 نمونه Component های React

### Login Component
```jsx
import { useState } from 'react';

function Login() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'code'

  const sendOTP = async () => {
    await apiRequest('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone })
    });
    setStep('code');
  };

  const verifyOTP = async () => {
    const data = await apiRequest('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code })
    });
    
    localStorage.setItem('auth_token', data.token);
    
    if (data.isNewUser) {
      // هدایت به صفحه تکمیل پروفایل
      navigate('/complete-profile');
    } else {
      // هدایت به داشبورد
      navigate('/dashboard');
    }
  };

  return (
    <div>
      {step === 'phone' ? (
        <>
          <input 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09121234567"
          />
          <button onClick={sendOTP}>ارسال کد</button>
        </>
      ) : (
        <>
          <input 
            value={code} 
            onChange={(e) => setCode(e.target.value)}
            placeholder="کد 6 رقمی"
          />
          <button onClick={verifyOTP}>تأیید</button>
        </>
      )}
    </div>
  );
}
```

### Queue Component
```jsx
import { useState, useEffect } from 'react';
import io from 'socket.io-client';

function DoctorQueue({ doctorId }) {
  const [queue, setQueue] = useState(null);

  useEffect(() => {
    // دریافت صف
    fetchQueue();
    
    // WebSocket
    const socket = io(SOCKET_URL, {
      auth: { token: getToken() }
    });
    
    socket.on('connect', () => {
      socket.emit('join:doctor', { doctorId });
    });
    
    socket.on('queue.update', (data) => {
      setQueue(prev => ({ ...prev, items: data.items }));
    });
    
    return () => socket.close();
  }, [doctorId]);

  const fetchQueue = async () => {
    const data = await apiRequest(`/doctor/${doctorId}/queue/today`);
    setQueue(data.queue);
  };

  const startVisit = async (itemId) => {
    await apiRequest(`/queue-items/${itemId}/start`, {
      method: 'POST'
    });
  };

  return (
    <div>
      <h2>صف امروز</h2>
      {queue?.items?.map(item => (
        <div key={item.id}>
          <h3>{item.patient_name}</h3>
          <p>زمان شروع: {new Date(item.estimated_start_at).toLocaleTimeString('fa-IR')}</p>
          <p>وضعیت: {item.status}</p>
          {item.status === 'waiting' && (
            <button onClick={() => startVisit(item.id)}>شروع</button>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Upload Test Component
```jsx
function UploadTest() {
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('description', description);

    const response = await fetch(`${API_BASE_URL}/tests/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      body: formData
    });

    const data = await response.json();
    console.log('Test uploaded:', data);
  };

  return (
    <div>
      <input 
        type="file" 
        onChange={(e) => setFile(e.target.files[0])}
        accept="image/*"
      />
      <textarea 
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="توضیحات"
      />
      <button onClick={handleUpload}>آپلود</button>
    </div>
  );
}
```

## 🎨 UI/UX توصیه‌ها

### وضعیت‌های صف
```css
.status-waiting { background: #fef3c7; }      /* زرد */
.status-in_progress { background: #dbeafe; }  /* آبی */
.status-done { background: #d1fae5; }         /* سبز */
.status-skipped { background: #fee2e2; }      /* قرمز */
```

### نمایش زمان
```javascript
// فرمت فارسی
const formatTime = (date) => {
  return new Date(date).toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// محاسبه زمان باقیمانده
const getTimeRemaining = (estimatedStart) => {
  const now = new Date();
  const start = new Date(estimatedStart);
  const diff = Math.floor((start - now) / 60000); // دقیقه
  
  if (diff < 0) return 'اکنون';
  if (diff < 60) return `${diff} دقیقه`;
  return `${Math.floor(diff / 60)} ساعت`;
};
```

### نوتیفیکیشن
```javascript
const showNotification = (message, type = 'info') => {
  // استفاده از کتابخانه مثل react-toastify
  toast(message, { type });
};

// مثال
socket.on('queue.item.started', () => {
  showNotification('ویزیت شروع شد', 'success');
});
```

## ⚠️ نکات مهم

### 1. Error Handling
```javascript
try {
  const data = await apiRequest('/endpoint');
} catch (error) {
  if (error.message.includes('توکن')) {
    // هدایت به صفحه لاگین
    navigate('/login');
  } else {
    showNotification(error.message, 'error');
  }
}
```

### 2. Loading States
```javascript
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  setLoading(true);
  try {
    const data = await apiRequest('/endpoint');
    setData(data);
  } finally {
    setLoading(false);
  }
};
```

### 3. WebSocket Reconnection
```javascript
socket.on('disconnect', () => {
  console.log('Disconnected, reconnecting...');
  setTimeout(() => {
    socket.connect();
  }, 1000);
});
```

### 4. Optimistic UI
```javascript
const startVisit = async (itemId) => {
  // فوراً UI را به‌روزرسانی کن
  setQueue(prev => ({
    ...prev,
    items: prev.items.map(item => 
      item.id === itemId 
        ? { ...item, status: 'in_progress' }
        : item
    )
  }));
  
  // سپس درخواست بفرست
  try {
    await apiRequest(`/queue-items/${itemId}/start`, {
      method: 'POST'
    });
  } catch (error) {
    // در صورت خطا، برگردان
    fetchQueue();
  }
};
```

## 🧪 تست API

### با Swagger UI
1. برو به `http://localhost:8889/api-docs`
2. Authorize کن
3. Try it out

### با curl
```bash
# ارسال OTP
curl -X POST http://localhost:8889/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"09121234567"}'

# دریافت صف
curl http://localhost:8889/api/doctor/1/queue/today \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### با Postman
Import کنید: `postman/Queue_API.postman_collection.json`

## 📞 پشتیبانی

- 📖 مستندات کامل: [`FRONTEND_INTEGRATION.md`](FRONTEND_INTEGRATION.md)
- 🔧 Swagger: `http://localhost:8889/api-docs`
- 📋 سیستم صف: [`docs/QUEUE_SYSTEM.md`](docs/QUEUE_SYSTEM.md)
- 🚀 شروع سریع: [`QUICK_START.md`](QUICK_START.md)

---

**موفق باشید! 🎉**
