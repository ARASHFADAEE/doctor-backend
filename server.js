require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { initDB } = require('./src/db');
const errorHandler = require('./src/middleware/errorHandler');

const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const testRoutes = require('./src/routes/tests');
const adminRoutes = require('./src/routes/admin');
const analyticsRoutes = require('./src/routes/analytics');
const queueRoutes = require('./src/routes/queue');

const { setupQueueSocket } = require('./src/sockets/queue.socket');
const { startNoShowChecker } = require('./src/workers/noShowCheck.worker');

// Swagger
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  }
});

// Attach io to app for use in controllers
app.io = io;

// Setup socket handlers
setupQueueSocket(io);

// Security & middlewares
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Static for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'MedAI Vision API Docs'
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api', queueRoutes);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

initDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`MedAI Vision backend running on port ${PORT}`);
      console.log(`Socket.IO server ready`);
      
      // Start background workers if enabled
      if (process.env.WORKER_ENABLED !== 'false') {
        startNoShowChecker();
      }
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
