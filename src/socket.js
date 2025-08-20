const { Server } = require('socket.io');
const { verifyToken } = require('./lib/jwt');
const User = require('./models/User');
const Message = require('./models/Message');
const connectDB = require('./lib/mongodb');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error('Authentication error'));
      }

      await connectDB();
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User ${socket.user.username} connected`);

    // Update user status to online
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      status: 'online',
      lastSeen: new Date()
    });

    // Join user to their server rooms
    const user = await User.findById(socket.userId).populate('servers');
    user.servers.forEach(server => {
      socket.join(`server:${server._id}`);
    });

    // Handle joining specific channel
    socket.on('join-channel', (channelId) => {
      console.log(`🔌 JOIN-CHANNEL event received: User ${socket.user.username} joining channel ${channelId}`);
      socket.join(`channel:${channelId}`);
      console.log(`✅ User ${socket.user.username} joined channel ${channelId}`);
      
      // Acknowledge the join
      socket.emit('channel-joined', { channelId });
      console.log(`📤 Sent channel-joined acknowledgment for ${channelId}`);
    });

    // Handle leaving specific channel
    socket.on('leave-channel', (channelId) => {
      console.log(`🔌 LEAVE-CHANNEL event received: User ${socket.user.username} leaving channel ${channelId}`);
      socket.leave(`channel:${channelId}`);
      console.log(`✅ User ${socket.user.username} left channel ${channelId}`);
      
      // Acknowledge the leave
      socket.emit('channel-left', { channelId });
    });

    // Handle sending messages
    socket.on('send-message', async (data) => {
      console.log(`🔌 SEND-MESSAGE event received from ${socket.user.username}:`, data);
      try {
        const { content, channelId, serverId } = data;

        if (!content || !channelId) {
          console.log(`❌ Invalid message data: content=${content}, channelId=${channelId}`);
          socket.emit('error', { message: 'Content and channel ID are required' });
          return;
        }

        console.log(`💾 Creating message in database...`);
        // Create message
        const message = new Message({
          content,
          author: socket.userId,
          channel: channelId,
          server: serverId
        });

        await message.save();
        console.log(`✅ Message saved to database with ID: ${message._id}`);

        // Populate message with author details
        await message.populate('author', 'username avatar status');
        console.log(`✅ Message populated with author: ${message.author.username}`);

        const messageData = {
          id: message._id,
          content: message.content,
          author: message.author,
          channel: message.channel,
          server: message.server,
          createdAt: message.createdAt,
          edited: message.edited,
          reactions: message.reactions
        };

        console.log(`📤 Emitting new-message to channel:${channelId}`, messageData);
        // Emit to channel
        io.to(`channel:${channelId}`).emit('new-message', messageData);
        console.log(`✅ Message emitted to all users in channel:${channelId}`);

      } catch (error) {
        console.error('❌ Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle message editing
    socket.on('edit-message', async (data) => {
      try {
        const { messageId, content } = data;

        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        if (message.author.toString() !== socket.userId) {
          socket.emit('error', { message: 'You can only edit your own messages' });
          return;
        }

        message.content = content;
        message.edited = true;
        message.editedAt = new Date();
        await message.save();

        await message.populate('author', 'username avatar status');

        io.to(`channel:${message.channel}`).emit('message-edited', {
          id: message._id,
          content: message.content,
          edited: message.edited,
          editedAt: message.editedAt
        });

      } catch (error) {
        console.error('Edit message error:', error);
        socket.emit('error', { message: 'Failed to edit message' });
      }
    });

    // Handle message deletion
    socket.on('delete-message', async (data) => {
      try {
        const { messageId } = data;

        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        if (message.author.toString() !== socket.userId) {
          socket.emit('error', { message: 'You can only delete your own messages' });
          return;
        }

        message.deleted = true;
        await message.save();

        io.to(`channel:${message.channel}`).emit('message-deleted', {
          id: message._id
        });

      } catch (error) {
        console.error('Delete message error:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // Handle typing indicators
    socket.on('typing-start', (data) => {
      console.log(`⌨️ TYPING-START event received from ${socket.user.username}:`, data);
      const { channelId } = data;
      
      if (!channelId) {
        console.log(`❌ Invalid typing-start data: channelId=${channelId}`);
        return;
      }

      console.log(`📡 Broadcasting typing-start to channel:${channelId}`);
      socket.to(`channel:${channelId}`).emit('user-typing', {
        userId: socket.userId,
        username: socket.user.username,
        channelId
      });
      console.log(`✅ Typing-start indicator sent to channel:${channelId}`);
    });

    socket.on('typing-stop', (data) => {
      console.log(`⌨️ TYPING-STOP event received from ${socket.user.username}:`, data);
      const { channelId } = data;
      
      if (!channelId) {
        console.log(`❌ Invalid typing-stop data: channelId=${channelId}`);
        return;
      }

      console.log(`📡 Broadcasting typing-stop to channel:${channelId}`);
      socket.to(`channel:${channelId}`).emit('user-stopped-typing', {
        userId: socket.userId,
        channelId
      });
      console.log(`✅ Typing-stop indicator sent to channel:${channelId}`);
    });

    // Handle status updates
    socket.on('update-status', async (data) => {
      try {
        const { status } = data;
        const validStatuses = ['online', 'away', 'busy', 'offline'];
        
        if (!validStatuses.includes(status)) {
          socket.emit('error', { message: 'Invalid status' });
          return;
        }

        await User.findByIdAndUpdate(socket.userId, { status });

        // Emit to all servers the user is in
        const user = await User.findById(socket.userId).populate('servers');
        user.servers.forEach(server => {
          socket.to(`server:${server._id}`).emit('user-status-updated', {
            userId: socket.userId,
            status
          });
        });

      } catch (error) {
        console.error('Update status error:', error);
        socket.emit('error', { message: 'Failed to update status' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User ${socket.user.username} disconnected`);
      
      // Update user status to offline
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        status: 'offline',
        lastSeen: new Date()
      });

      // Notify servers about user going offline
      const user = await User.findById(socket.userId).populate('servers');
      user.servers.forEach(server => {
        socket.to(`server:${server._id}`).emit('user-status-updated', {
          userId: socket.userId,
          status: 'offline',
          isOnline: false
        });
      });
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = { initSocket, getIO };
