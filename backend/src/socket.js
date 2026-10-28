const { db } = require('./db');
const { SECRET } = require('./middleware/auth');
const jwt = require('jsonwebtoken');

const onlineUsers = new Map();

function setupSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));
    try {
      socket.user = jwt.verify(token, SECRET);
      next();
    } catch (e) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    onlineUsers.set(socket.user.id, {
      id: socket.user.id,
      displayName: socket.user.displayName,
      accountCode: socket.user.accountCode,
      role: socket.user.role,
      socketId: socket.id
    });
    socket.join('global');
    socket.join(`user:${socket.user.id}`);
    io.emit('users:online', Array.from(onlineUsers.values()));
    socket.broadcast.emit('user:joined', { id: socket.user.id, displayName: socket.user.displayName });

    socket.on('chat:typing', (data) => {
      socket.broadcast.emit('chat:typing', { userId: socket.user.id, displayName: socket.user.displayName, ...data });
    });

    socket.on('chat:stop-typing', () => {
      socket.broadcast.emit('chat:stop-typing', { userId: socket.user.id });
    });

    socket.on('process:viewing', (processId) => {
      socket.join(`process:${processId}`);
      const viewers = [];
      for (const [uid, u] of onlineUsers) {
        if (u.socketId !== socket.id) viewers.push({ id: uid, displayName: u.displayName });
      }
      io.to(`process:${processId}`).emit('process:viewers', { processId, viewers });
    });

    socket.on('process:leave', (processId) => {
      socket.leave(`process:${processId}`);
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(socket.user.id);
      io.emit('users:online', Array.from(onlineUsers.values()));
      io.emit('user:left', { id: socket.user.id, displayName: socket.user.displayName });
    });
  });
}

module.exports = { setupSocket, onlineUsers };