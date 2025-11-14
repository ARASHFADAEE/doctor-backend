1) خلاصه هدف (short)

ایجاد ماژول صف/نوبت هوشمند که:

برای هر پزشک صف مدیریت می‌کند.

بر اساس میانگین زمانی عمومی (مثلاً 8 دقیقه) و میانگین تاریخی آن پزشک/بیمار، زمان تخمینی ورود و انتظار را محاسبه می‌کند.

امکان نوبت‌دهی بازه‌ای (time-window) و تخصیص پویا به منظور جلوگیری از تجمع بیماران در ساعت مشخص فراهم می‌کند.

تایمر واقعی برای هر ویزیت، اعلام هشدار/صدای کوتاه (در فرانت/ساختار پیام‌رسانی) می‌فرستد تا پزشک/پرستار متوجه شود که وقت بیمار به پایان رسیده.

API و WebSocket برای داشبورد دکتر/پرستار/پذیرش و اپ موبایل بیمار.

لاگ و آنالیز تاریخی برای بهبود مدل‌های تخمینی زمان و شخصی‌سازی.

2) مفاهیم کلیدی (entities + statuses)

Appointment / Visit (گسترش جدول موجود tests یا جدول جدید)

status: scheduled | checked_in | in_room | completed | no_show | cancelled

scheduled_time, expected_duration_minutes, actual_start_at, actual_end_at, room_id, queue_position

Queue (برای هر پزشک و روز) — نمای لحظه‌ای صف

doctor_id, date, created_at

QueueItem (هر رکورد صف)

id, queue_id, appointment_id (optional), patient_id, expected_duration, estimated_start_at, estimated_end_at, status (waiting|in_progress|done|skipped), created_at

DoctorSettings

default_duration_minutes (مثلاً 8), buffer_before_minutes, buffer_after_minutes, max_simultaneous_in_room (0/1), allow_overflow

Room (اختیاری)

id, name, doctor_id

TimerEvents / Audit

queue_item_id, event_type (start|pause|extend|end), actor (doctor|nurse|system), timestamp, note

3) دیتابیس — تغییرات پیشنهادی (MySQL)

پیشنهاد می‌کنم جداول جدید زیر اضافه شوند. اگر از migration استفاده می‌کنی، نمونه SQL مهاجرت را همینجا دارم.

-- Doctor settings
CREATE TABLE doctor_settings (
  doctor_id BIGINT PRIMARY KEY,
  default_duration_minutes INT NOT NULL DEFAULT 8,
  buffer_before_minutes INT NOT NULL DEFAULT 0,
  buffer_after_minutes INT NOT NULL DEFAULT 0,
  allow_overflow BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Rooms (اختیاری)
CREATE TABLE rooms (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  doctor_id BIGINT NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments / Visits (extension)
CREATE TABLE appointments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT NOT NULL,
  doctor_id BIGINT NOT NULL,
  scheduled_time DATETIME NULL,
  expected_duration_minutes INT NULL,
  status ENUM('scheduled','checked_in','in_room','completed','no_show','cancelled') DEFAULT 'scheduled',
  room_id BIGINT NULL,
  actual_start_at DATETIME NULL,
  actual_end_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Queues per doctor per day
CREATE TABLE doctor_queues (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  doctor_id BIGINT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY(doctor_id,date)
);

-- Queue items
CREATE TABLE queue_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  queue_id BIGINT NOT NULL,
  appointment_id BIGINT NULL,
  patient_id BIGINT NOT NULL,
  position INT NOT NULL,
  expected_duration_minutes INT NOT NULL,
  estimated_start_at DATETIME NULL,
  estimated_end_at DATETIME NULL,
  status ENUM('waiting','in_progress','done','skipped') DEFAULT 'waiting',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Timer / audit
CREATE TABLE queue_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  queue_item_id BIGINT NOT NULL,
  event_type ENUM('start','pause','extend','end','manual_override') NOT NULL,
  actor VARCHAR(50),
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  note TEXT
);


نکته: appointment می‌تواند هم‌زمان در tests موجود یا مکانیزم جداگانه ذخیره شود. اگر قبلاً appointments در سیستم نیست، جدول بالا جایگزین خواهد شد. اگر دارید از جدول tests استفاده می‌کنید، کافیست فیلدهای expected_duration_minutes, status, actual_start_at, actual_end_at را به آن جدول اضافه کنید.

4) محاسبات و الگوریتم‌ها
4.1 محاسبهٔ زمان تخمینی (estimated start / wait)

الگوریتم پیشنهادی برای محاسبهٔ estimated_start_at برای هر queue_item:

برای صف یک doctor و تاریخ مشخص، ایتم‌ها را براساس position مرتب کن.

برای position اول، estimated_start = max( now, scheduled_time (اگر وجود دارد), last_end_time_of_previous_day? ).

برای item بعدی: estimated_start = previous.estimated_end.

estimated_end = estimated_start + expected_duration + buffer_after (از doctor_settings).

اگر patient-specific history موجود باشد، expected_duration = weighted average بین:

doctor_settings.default_duration (مثلاً 8)

historical average duration for this patient with this doctor (مثلاً last N visits)

overall doctor's historical average per patient type / tag
وزن‌ها می‌توانند قابل تنظیم باشند: e.g. 0.5 default + 0.3 patient_avg + 0.2 doctor_avg.

فرمول نمونه:

expected_duration = round( 0.5*doctor_default + 0.4*patient_avg + 0.1*doctor_avg )

4.2 بروزرسانی زنده هنگام تغییر واقعی (dynamic recalculation)

وقتی یک بیمار وارد اتاق می‌شود (start event) و actual_start ثبت می‌شود، باید estimated times برای همه itemهای بعدی دوباره محاسبه شود (reflow).

در صورتی که ویزیت بیش از estimated طول بکشد و به‌عنوان مثال ۱۲ دقیقه شود، برای جلوگیری از انباشت، دو راه:

اعلام هشدار/نوتیف به بیماران بعدی و پذیرش (از طریق push / SMS) — مثلاً «تأخیر ~4 دقیقه».

پوشش با buffer: در کانفیگ doctor، اگر allow_overflow = false، سیستم می‌تواند بیماران را به بازه‌های زمانی بعدی منتقل کند.

4.3 سیاست نوبت‌دهی برای کاهش تجمع (scheduling policy)

هدف: جلوگیری از دادن تعداد زیاد نوبت همزمان. چند گزینه:

Staggered scheduling: به جای دادن slot‌های یکسان (مثلاً 09:00، 09:00، 09:00)، سیستم بازه‌ای می‌دهد — با فاصلۀ میانگین expected_duration.

Dynamic open window: اگر تعداد زیادی نوبت در یک بازه هست، پیشنهاد به کاربر برای انتخاب بازهٔ دیگر یا نمایش estimated_wait در UI.

Soft cap for remote check-in: اگر بیمار چک‌این زودتر از X دقیقه قبل از scheduled_time بیاید، او را در virtual waiting list قرار بده و estimated arrival time براساس صف تنظیم کن.

4.4 کنترل‌های عملیاتی

No-show: اگر بیمار بعد از N دقیقه از scheduled_time چک‌این نمی‌کند یا پذیرش نکرده، وضعیت no_show می‌گیرد (قابل تنظیم).

Grace / grace_alert: قبل از تغییر وضعیت no_show، پیامک/پوش هشدار ارسال شود.

Manual overrides: پذیرش/دکتر می‌تواند position را دستی تغییر دهد (رویداد logged).

5) API روت‌ها (Express style)

پیشنهاد می‌کنم این روت‌ها را اضافه کنی. همه روت‌های حساس با requireRole('doctor'|'admin'|'reception') محافظت شوند.

Queue management
POST /api/queues/:doctorId/date/:yyyy-mm-dd
Response: { queue_id }

GET  /api/queues/:doctorId/date/:yyyy-mm-dd
Response: { queue: [ queue_items sorted ] }

POST /api/queues/:queueId/enqueue
Body: { appointment_id?, patient_id, expected_duration_minutes? }
Response: { queue_item }

POST /api/queues/:queueId/position
Body: { queue_item_id, new_position }
(برای جابجایی دستی)

POST /api/queue-items/:id/start
Body: { actor: 'doctor'|'nurse' }
Effect: sets status=in_progress, actual_start_at = now, emits socket event

POST /api/queue-items/:id/end
Body: { actual_end_at? }  // optional override
Effect: status=done, actual_end set, recalc estimates

POST /api/queue-items/:id/extend
Body: { extra_minutes, note? }
Effect: logs event, recalcs

GET  /api/queues/:queueId/estimated (or included in GET queue)
Response: includes estimated_start and estimated_end per item

Scheduling / appointment
POST /api/appointments
Body: { patient_id, doctor_id, scheduled_time, expected_duration_minutes? }

GET /api/appointments/:id
PUT /api/appointments/:id  (update, cancel)

Settings
GET /api/doctors/:id/settings
PUT /api/doctors/:id/settings

Dashboards (doctor)
GET /api/doctor/:id/queue/today  // returns queue with estimates
POST /api/doctor/:id/force-skip/:queue_item_id
GET /api/doctor/:id/history/durations?months=6

6) Real-time: WebSockets / Events

Socket namespace per doctor: socket.io rooms doctor:<doctor_id>, reception:<doctor_id>, patient:<patient_id>

Events:

queue.update — کل صف یا ایتم تغییر کرده

queue.item.started — item شروع شد

queue.item.ended — item پایان یافت

queue.estimated_change — اگر ETAs تغییر کند (payload: affected_items[])

timer.tick — (اختیاری) هر ثانیه/هر دقیقه برای صفحهٔ doctor timer

پیاده‌سازی: socket.io + Redis adapter (در صورت چندین instance) برای مقیاس.

7) Background workers و reliability

برای recalculation و نوتیف‌ها از یک worker queue استفاده کن (BullMQ یا Bee-Queue):

job: recalculate-queue (debounce: وقتی یک start/end/extend رخ می‌دهد، job را schedule کن تا بعد از 200-500ms اجرا شود — جلوگیری از recalculation زیاد)

job: no-show-check — scheduled job بررسی کند بیمار‌هایی که check-in نکردند و وضعیت را به no_show تغییر دهد.

برای هشدارها/ایمیل/SMS از سرویس جداگانه استفاده کن (sms.service.js موجود). اگر پیامک گران است، از push notifications یا داخلی استفاده کن.

8) Locking & concurrency

هنگام enqueue/dequeue/position change از transaction و row-level locking استفاده کن:

مثال: SELECT ... FOR UPDATE روی doctor_queues یا روی آخرین queue_items قبل از insert position.

برای جلوگیری از race condition هنگام multiple clients، یک optimistic versioning یا DB lock را اعمال کن.

9) امنیت و حریم خصوصی

فقط کاربران با نقش مناسب می‌توانند queue/appointments پزشک را ببینند (doctor, reception, admin).

اطلاعات حساس (medical tests) را بدون نیاز encrypt ذخیره کن؟ (براساس قوانین محلی). لاگ‌ها محدود و دسترسی‌پذیر با audit.

Rate-limit جهت جلوگیری از سوءاستفاده از API‌های enqueue/SMS.

10) Telemetry & analytics

از جدول queue_events برای محاسبهٔ میانگین زمان واقعی هر patient/doctor.

محاسبات: average visit duration per doctor per month، median، 95th percentile.

این دیتا را برای بهبود expected_duration استفاده کن (weights تغییر یابند بر مبنای confidence).

11) UX notes (چیزهایی که بک‌اند باید پشتیبانی کنه)

Front-end باید بتواند:

بیمار را check-in کند (mobile/web).

وضعیت "در حال انتظار" با ETA بگیرد.

دکمهٔ start/stop/extend برای پزشک داشته باشد.

هشدارهای کوتاه (مثلاً 30s/1min) قبل از پایان زمان ارسال کند.

برای پذیرش: امکان override برای extend زمان یا skip.

SMS/push: هنگام تغییر ETA بزرگ‌تر از threshold (مثلاً > 5 دقیقه) به بیماران اطلاع داده شود.

12) نمونه سناریو (flow)

پذیرش نوبت می‌دهد: سیستم enqueue می‌کند و estimated_start محاسبه می‌شود.

بیمار 20 دقیقه قبل می‌رسد و check-in می‌کند: وضعیت checked_in.

وقتی بیمار وارد اتاق می‌شود، پزشک start می‌زند → actual_start_at ثبت می‌شود، queue.update انتشار می‌یابد و ETAs برای بقیه بازمحاسبه می‌شود.

اگر ویزیت 12 دقیقه شد، پزشک extend +4 می‌زند یا end دیرتر ثبت می‌شود → recalculation و notify.

پس از چند هفته، آنالیز می‌گوید این بیمار معمولاً 12 دقیقه طول می‌کشد؛ در دفعات بعدی expected_duration او 12 لحاظ می‌شود.

13) Migration & rollout plan (پیوسته)

اضافه کردن جداول settings, appointments, doctor_queues, queue_items, queue_events.

API read-only: محاسبه و نمایش estimated بر اساس داده‌های تستی.

اضافه کردن enqueue / dequeue endpoints با locking.

Live socket events و UI.

Worker jobs و no-show handling.

Telemetry و auto-tuning of durations.

A/B: فعال‌سازی تدریجی برای چند مطب و نظارت.

14) معیارهای پذیرش (Acceptance criteria)

وقتی یک patient enqueue می‌شود، GET /api/queues/:doctor/:date بازهٔ تخمینی شروع و پایان را درست برمی‌گرداند (با دقت ≤1 دقیقه در شرایط غیر‌مشوش).

وقتی start یا end زده می‌شود، همه ETAs برای ایتم‌های بعدی دوباره محاسبه و از طریق WebSocket منتشر می‌شوند.

امکان override دستی موقعیت و مدت زمان وجود دارد و همه تغییرات در queue_events لاگ می‌شوند.

سیستم لاک برای جلوگیری از دو enqueue همزمان که position تکراری بسازد، دارد.

No-show و cancel طبق تنظیمات کار می‌کنند و پیام هشدار به بیمار ارسال می‌شود.

Unit tests برای محاسبهٔ expected_duration و integration tests برای flow enqueue→start→end وجود داشته باشند.

15) نمونه کد پِی‌نوشت (pseudocode / service)

(فقط نمای کلی)

// queueService.enqueue(queueId, {patientId, appointmentId, expectedDuration})
// 1. BEGIN TRANSACTION
// 2. find max(position) FOR UPDATE
// 3. insert queue_item with position = max+1
// 4. compute estimated_start/end based on previous item
// 5. COMMIT
// 6. emit socket 'queue.update'

16) Unit / Integration Tests پیشنهادی

unit: computeExpectedDuration() با حالات مختلف (no history, patient history only, doctor history)

integration: enqueue sequence and ensure estimated times are non-overlapping and monotonic

concurrency test: simulate 20 concurrent enqueue requests and assert positions are unique

socket test: on start, ensure queue.update emitted and subsequent items updated

17) Logging & monitoring

هر recalculation باید با سطح DEBUG لاگ شود؛ مواردی که تغییر ETA بیش از threshold (مثلاً 5 دقیقه) داشته باشند به پایش (alert) فرستاده شود.

Metrics: queue length per doctor, average wait, avg service time, no-shows %

18) ریسک‌ها و ملاحظات

اگر پزشک به‌صورت غیرقابل پیش‌بینی طولانی صحبت کند (مثلاً 30+ دقیقه)، باید UI طبیعتاً پیام بگذارد و پذیرش/بیماران بعدی را اطلاع دهد. این مورد را با سیاست allow_overflow یا جابجایی خودکار مدیریت کن.

حساسیت‌های مربوط به GDPR/قوانین محلی: داده‌ها لاگ می‌شود؛ دسترسی محدود.




پروژه به طبان فارسی هست این هم توجه کن