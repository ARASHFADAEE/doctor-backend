# راهنمای استقرار (Deployment)

این راهنما مراحل استقرار سیستم صف هوشمند در محیط production را شرح می‌دهد.

## پیش‌نیازها

- ✅ Node.js 16+ نصب شده
- ✅ MySQL 8.0+ نصب شده
- ✅ دامنه و SSL certificate (برای HTTPS)
- ✅ سرور با حداقل 2GB RAM
- ⚠️ Redis (اختیاری - برای multi-instance)

## چک‌لیست قبل از استقرار

### 1. امنیت

- [ ] `JWT_SECRET` را به یک مقدار قوی و تصادفی تغییر دهید
- [ ] `NODE_ENV=production` تنظیم شود
- [ ] HTTPS فعال باشد
- [ ] `CORS_ORIGIN` به دامنه واقعی تنظیم شود
- [ ] دسترسی دیتابیس محدود شود (فقط از localhost)
- [ ] Firewall تنظیم شود
- [ ] Rate limiting فعال باشد

### 2. دیتابیس

- [ ] Backup خودکار تنظیم شود
- [ ] Connection pool بهینه شود
- [ ] Indexes بررسی شوند
- [ ] Slow query log فعال شود

### 3. Monitoring

- [ ] Logging تنظیم شود (Winston)
- [ ] Error tracking (Sentry یا مشابه)
- [ ] Performance monitoring
- [ ] Uptime monitoring

## روش‌های استقرار

### روش 1: استقرار مستقیم (Traditional)

#### مرحله 1: آماده‌سازی سرور

```bash
# به‌روزرسانی سیستم
sudo apt update && sudo apt upgrade -y

# نصب Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# نصب MySQL
sudo apt install -y mysql-server

# نصب PM2 (process manager)
sudo npm install -g pm2
```

#### مرحله 2: کلون و نصب

```bash
# کلون پروژه
git clone <repository-url> /var/www/medai-backend
cd /var/www/medai-backend

# نصب dependencies
npm ci --only=production

# کپی و تنظیم .env
cp .env.example .env
nano .env  # ویرایش تنظیمات
```

#### مرحله 3: تنظیم دیتابیس

```bash
# ورود به MySQL
sudo mysql -u root -p

# ایجاد دیتابیس و کاربر
CREATE DATABASE medai_vision CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'medai_user'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON medai_vision.* TO 'medai_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# اجرای migration (جداول خودکار ایجاد می‌شوند)
```

#### مرحله 4: اجرا با PM2

```bash
# شروع با PM2
pm2 start server.js --name medai-backend

# ذخیره برای راه‌اندازی خودکار
pm2 save
pm2 startup

# مشاهده لاگ‌ها
pm2 logs medai-backend

# مانیتورینگ
pm2 monit
```

#### مرحله 5: تنظیم Nginx (Reverse Proxy)

```bash
sudo nano /etc/nginx/sites-available/medai-backend
```

```nginx
upstream medai_backend {
    server 127.0.0.1:5000;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://medai_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://medai_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files
    location /uploads/ {
        alias /var/www/medai-backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# فعال‌سازی
sudo ln -s /etc/nginx/sites-available/medai-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### مرحله 6: SSL با Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### روش 2: استقرار با Docker

#### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start
CMD ["node", "server.js"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build: .
    container_name: medai-backend
    restart: unless-stopped
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DB_HOST=mysql
      - DB_USER=medai_user
      - DB_PASS=${DB_PASS}
      - DB_NAME=medai_vision
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=${CORS_ORIGIN}
      - WORKER_ENABLED=true
    depends_on:
      - mysql
      - redis
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    networks:
      - medai-network

  mysql:
    image: mysql:8.0
    container_name: medai-mysql
    restart: unless-stopped
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=medai_vision
      - MYSQL_USER=medai_user
      - MYSQL_PASSWORD=${DB_PASS}
    volumes:
      - mysql-data:/var/lib/mysql
      - ./migrations:/docker-entrypoint-initdb.d
    networks:
      - medai-network

  redis:
    image: redis:7-alpine
    container_name: medai-redis
    restart: unless-stopped
    networks:
      - medai-network

  nginx:
    image: nginx:alpine
    container_name: medai-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend
    networks:
      - medai-network

volumes:
  mysql-data:

networks:
  medai-network:
    driver: bridge
```

#### اجرا

```bash
# ایجاد .env
cp .env.example .env
nano .env

# Build و اجرا
docker-compose up -d

# مشاهده لاگ‌ها
docker-compose logs -f backend

# متوقف کردن
docker-compose down
```

## تنظیمات Production

### Environment Variables

```env
# Production settings
NODE_ENV=production
PORT=5000

# Database
DB_HOST=localhost
DB_USER=medai_user
DB_PASS=STRONG_PASSWORD_HERE
DB_NAME=medai_vision

# Security
JWT_SECRET=VERY_STRONG_RANDOM_SECRET_HERE_AT_LEAST_32_CHARS

# CORS
CORS_ORIGIN=https://yourdomain.com

# Workers
WORKER_ENABLED=true

# Redis (for multi-instance)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/medai/app.log

# SMS
KAVENEGAR_API_KEY=your_key

# OpenAI
OPENAI_API_KEY=your_key
```

### بهینه‌سازی MySQL

```sql
-- در /etc/mysql/mysql.conf.d/mysqld.cnf

[mysqld]
# Connection pool
max_connections = 200
thread_cache_size = 16

# Buffer pool (70-80% of RAM)
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M

# Query cache
query_cache_type = 1
query_cache_size = 64M

# Slow query log
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
```

### بهینه‌سازی Node.js

```bash
# در PM2 ecosystem file
module.exports = {
  apps: [{
    name: 'medai-backend',
    script: './server.js',
    instances: 'max',  // استفاده از تمام CPU cores
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
};

# اجرا
pm2 start ecosystem.config.js --env production
```

## Monitoring و Logging

### Winston Logging

```javascript
// در server.js اضافه کنید
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### Health Check Endpoint

```javascript
// اضافه کردن به server.js
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

## Backup

### Backup خودکار MySQL

```bash
# اسکریپت backup
#!/bin/bash
BACKUP_DIR="/var/backups/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u medai_user -p medai_vision | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# نگه‌داری فقط 7 روز اخیر
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

# اضافه به crontab
crontab -e
# هر روز ساعت 2 صبح
0 2 * * * /path/to/backup-script.sh
```

## Scaling

### Multi-Instance با Redis

```bash
# نصب Redis adapter برای Socket.IO
npm install @socket.io/redis-adapter redis

# در server.js
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
});
```

## مشکلات رایج

### خطای EADDRINUSE

```bash
# پیدا کردن process روی پورت 5000
sudo lsof -i :5000
# یا
sudo netstat -tulpn | grep 5000

# kill کردن
sudo kill -9 <PID>
```

### خطای MySQL Connection

```bash
# بررسی وضعیت MySQL
sudo systemctl status mysql

# بررسی لاگ‌ها
sudo tail -f /var/log/mysql/error.log

# تست اتصال
mysql -u medai_user -p -h localhost medai_vision
```

### مشکل Socket.IO

- بررسی CORS settings
- بررسی Nginx WebSocket config
- بررسی firewall rules

## بروزرسانی

```bash
# Pull آخرین تغییرات
cd /var/www/medai-backend
git pull origin main

# نصب dependencies جدید
npm ci --only=production

# Restart
pm2 restart medai-backend

# یا با Docker
docker-compose pull
docker-compose up -d --build
```

## امنیت اضافی

### Fail2ban برای محافظت از API

```bash
# نصب
sudo apt install fail2ban

# تنظیم
sudo nano /etc/fail2ban/jail.local
```

```ini
[medai-api]
enabled = true
port = 80,443
filter = medai-api
logpath = /var/log/nginx/access.log
maxretry = 5
bantime = 3600
```

---

**موفق باشید! 🚀**
