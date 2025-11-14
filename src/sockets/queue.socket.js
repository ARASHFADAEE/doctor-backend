/**
 * Socket.IO handlers for real-time queue updates
 * Rooms: queue:{queueId}, doctor:{doctorId}, patient:{patientId}
 */

const jwt = require('jsonwebtoken');

function verifySocketToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function setupQueueSocket(io) {
  // Socket authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    const payload = verifySocketToken(token);
    if (!payload || payload.type !== 'full') {
      return next(new Error('Invalid token'));
    }
    
    socket.userId = payload.sub;
    socket.userRole = payload.role;
    next();
  });
  
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}, user: ${socket.userId}`);
    
    // Join queue room
    socket.on('join:queue', (data) => {
      const { queueId } = data;
      
      if (!queueId) {
        socket.emit('error', { message: 'شناسه صف الزامی است' });
        return;
      }
      
      // Authorization check - only doctors and admins can join queue rooms
      if (!['doctor', 'admin'].includes(socket.userRole)) {
        socket.emit('error', { message: 'دسترسی غیرمجاز' });
        return;
      }
      
      socket.join(`queue:${queueId}`);
      console.log(`User ${socket.userId} joined queue:${queueId}`);
      
      socket.emit('joined:queue', { queueId });
    });
    
    // Leave queue room
    socket.on('leave:queue', (data) => {
      const { queueId } = data;
      
      if (queueId) {
        socket.leave(`queue:${queueId}`);
        console.log(`User ${socket.userId} left queue:${queueId}`);
      }
    });
    
    // Join doctor room (for receiving notifications)
    socket.on('join:doctor', (data) => {
      const { doctorId } = data;
      
      if (!doctorId) {
        socket.emit('error', { message: 'شناسه پزشک الزامی است' });
        return;
      }
      
      // Only the doctor themselves or admins can join
      if (socket.userId != doctorId && socket.userRole !== 'admin') {
        socket.emit('error', { message: 'دسترسی غیرمجاز' });
        return;
      }
      
      socket.join(`doctor:${doctorId}`);
      console.log(`User ${socket.userId} joined doctor:${doctorId}`);
      
      socket.emit('joined:doctor', { doctorId });
    });
    
    // Join patient room (for receiving wait time updates)
    socket.on('join:patient', (data) => {
      const { patientId } = data;
      
      if (!patientId) {
        socket.emit('error', { message: 'شناسه بیمار الزامی است' });
        return;
      }
      
      // Only the patient themselves or admins can join
      if (socket.userId != patientId && socket.userRole !== 'admin') {
        socket.emit('error', { message: 'دسترسی غیرمجاز' });
        return;
      }
      
      socket.join(`patient:${patientId}`);
      console.log(`User ${socket.userId} joined patient:${patientId}`);
      
      socket.emit('joined:patient', { patientId });
    });
    
    // Timer tick (optional - for real-time countdown in UI)
    socket.on('timer:tick', (data) => {
      const { queueItemId, remainingSeconds } = data;
      
      // Broadcast to queue room
      if (data.queueId) {
        io.to(`queue:${data.queueId}`).emit('timer.tick', {
          queueItemId,
          remainingSeconds
        });
      }
    });
    
    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
  
  return io;
}

module.exports = { setupQueueSocket };
