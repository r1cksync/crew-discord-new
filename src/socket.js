const { Server: SocketServer } = require('socket.io');
const { verifyToken } = require('./lib/jwt');
const User = require('./models/User');
const Message = require('./models/Message');
const ServerModel = require('./models/Server');
const { DirectMessageConversation, DirectMessage } = require('./models/DirectMessage');
const connectDB = require('./lib/mongodb');

let io;

// Store instance globally for Next.js
if (typeof global !== 'undefined') {
  global._socketIO = global._socketIO || null;
}

const initSocket = (server) => {
  io = new SocketServer(server, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  // Store globally for Next.js API routes
  if (typeof global !== 'undefined') {
    global._socketIO = io;
  }

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
    console.log('🔧 Starting to register event handlers...');

    // Update user status to online
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      status: 'online',
      lastSeen: new Date()
    });

    // Join user to their personal room for friend notifications
    socket.join(`user:${socket.userId}`);

    // Join user to their server rooms
    const user = await User.findById(socket.userId).populate('servers').populate('friends');
    user.servers.forEach(server => {
      socket.join(`server:${server._id}`);
    });

    // Notify friends that user came online
    user.friends.forEach(friend => {
      io.to(`user:${friend._id}`).emit('friend-status-updated', {
        friendId: socket.userId,
        username: socket.user.username,
        status: 'online',
        isOnline: true
      });
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

    // Handle direct message events
    console.log('🔧 Registering send-dm handler...');
    socket.on('send-dm', async (data) => {
      console.log(`💬 SEND-DM event received from ${socket.user.username}:`, data);
      try {
        await connectDB(); // Ensure DB connection
        
        const { content, recipientId } = data;

        if (!content || !recipientId) {
          console.log(`❌ Invalid DM data: content=${content}, recipientId=${recipientId}`);
          socket.emit('error', { message: 'Content and recipient ID are required' });
          return;
        }

        // Check if recipient exists
        const recipient = await User.findById(recipientId).select('username avatar blockedUsers');
        if (!recipient) {
          socket.emit('error', { message: 'Recipient not found' });
          return;
        }

        // Check if sender is blocked by recipient
        const isBlocked = recipient.blockedUsers?.some(blockedId => 
          blockedId.toString() === socket.userId
        );

        if (isBlocked) {
          socket.emit('error', { message: 'You cannot send messages to this user' });
          return;
        }

        console.log(`💾 Creating DM conversation and message...`);
        
        // Find or create conversation
        let conversation = await DirectMessageConversation.findOne({
          participants: { $all: [socket.userId, recipientId] }
        });

        if (!conversation) {
          conversation = new DirectMessageConversation({
            participants: [socket.userId, recipientId]
          });
          await conversation.save();
          console.log(`✅ New conversation created: ${conversation._id}`);
        } else {
          console.log(`✅ Found existing conversation: ${conversation._id}`);
        }

        // Create direct message
        const directMessage = new DirectMessage({
          content: content.trim(),
          author: socket.userId,
          conversation: conversation._id
        });

        await directMessage.save();
        console.log(`✅ DM saved to database with ID: ${directMessage._id}`);

        // Update conversation
        conversation.lastMessage = directMessage._id;
        conversation.lastActivity = new Date();
        await conversation.save();

        // Populate the message with author details
        await directMessage.populate('author', 'username avatar status');

        const messageData = {
          id: directMessage._id,
          content: directMessage.content,
          author: directMessage.author,
          createdAt: directMessage.createdAt,
          edited: directMessage.edited
        };

        console.log(`📤 Emitting dm-received to user:${recipientId}`);
        // Notify the recipient
        io.to(`user:${recipientId}`).emit('dm-received', {
          message: messageData,
          sender: {
            id: socket.userId,
            username: socket.user.username,
            avatar: socket.user.avatar
          },
          notification: `New message from ${socket.user.username}`,
          timestamp: new Date()
        });

        console.log(`📤 Emitting dm-sent confirmation to user:${socket.userId}`);
        // Confirm to sender that message was sent
        socket.emit('dm-sent', {
          message: messageData,
          recipient: {
            id: recipient._id,
            username: recipient.username,
            avatar: recipient.avatar
          },
          timestamp: new Date()
        });

        console.log(`✅ DM successfully sent from ${socket.user.username} to ${recipient.username}`);

      } catch (error) {
        console.error('❌ Send DM error:', error);
        socket.emit('error', { message: 'Failed to send direct message' });
      }
    });

    // Handle DM typing indicators
    socket.on('dm-typing-start', (data) => {
      console.log(`⌨️ DM-TYPING-START event received from ${socket.user.username}:`, data);
      const { recipientId } = data;
      
      if (!recipientId) {
        console.log(`❌ Invalid dm-typing-start data: recipientId=${recipientId}`);
        return;
      }

      console.log(`📡 Broadcasting dm-typing-start to user:${recipientId}`);
      io.to(`user:${recipientId}`).emit('dm-user-typing', {
        userId: socket.userId,
        username: socket.user.username,
        avatar: socket.user.avatar
      });
      console.log(`✅ DM typing-start indicator sent to user:${recipientId}`);
    });

    socket.on('dm-typing-stop', (data) => {
      console.log(`⌨️ DM-TYPING-STOP event received from ${socket.user.username}:`, data);
      const { recipientId } = data;
      
      if (!recipientId) {
        console.log(`❌ Invalid dm-typing-stop data: recipientId=${recipientId}`);
        return;
      }

      console.log(`📡 Broadcasting dm-typing-stop to user:${recipientId}`);
      io.to(`user:${recipientId}`).emit('dm-user-stopped-typing', {
        userId: socket.userId
      });
      console.log(`✅ DM typing-stop indicator sent to user:${recipientId}`);
    });

    // Handle DM read status
    socket.on('mark-dm-read', async (data) => {
      console.log(`👁️ MARK-DM-READ event received from ${socket.user.username}:`, data);
      try {
        const { messageId, senderId } = data;

        if (!messageId || !senderId) {
          console.log(`❌ Invalid mark-dm-read data: messageId=${messageId}, senderId=${senderId}`);
          socket.emit('error', { message: 'Message ID and sender ID are required' });
          return;
        }

        // Update message as read
        const message = await DirectMessage.findById(messageId).populate('conversation');
        if (message && message.conversation) {
          // Check if the current user is a participant in this conversation
          const isParticipant = message.conversation.participants.some(
            p => p.toString() === socket.userId
          );
          
          if (isParticipant && message.author.toString() !== socket.userId) {
            message.read = true;
            message.readAt = new Date();
            await message.save();

            console.log(`📤 Emitting dm-read to user:${senderId}`);
            // Notify the sender that their message was read
            io.to(`user:${senderId}`).emit('dm-read', {
              messageId: messageId,
              readBy: {
                id: socket.userId,
                username: socket.user.username
              },
              readAt: message.readAt
            });

            console.log(`✅ DM read status updated for message:${messageId}`);
          }
        }

      } catch (error) {
        console.error('❌ Mark DM read error:', error);
        socket.emit('error', { message: 'Failed to mark message as read' });
      }
    });

    // Handle DM editing
    socket.on('edit-dm', async (data) => {
      console.log(`✏️ EDIT-DM event received from ${socket.user.username}:`, data);
      try {
        const { messageId, content } = data;

        if (!messageId || !content) {
          console.log(`❌ Invalid edit-dm data: messageId=${messageId}, content=${content}`);
          socket.emit('error', { message: 'Message ID and content are required' });
          return;
        }

        const message = await DirectMessage.findById(messageId).populate('conversation');
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        if (message.author.toString() !== socket.userId) {
          socket.emit('error', { message: 'You can only edit your own messages' });
          return;
        }

        message.content = content.trim();
        message.edited = true;
        message.editedAt = new Date();
        await message.save();

        await message.populate('author', 'username avatar status');

        const editedMessageData = {
          id: message._id,
          content: message.content,
          edited: message.edited,
          editedAt: message.editedAt
        };

        // Get the other participant (recipient)
        const otherParticipant = message.conversation.participants.find(
          p => p.toString() !== socket.userId
        );

        if (otherParticipant) {
          console.log(`📤 Emitting dm-edited to user:${otherParticipant}`);
          // Notify the recipient about the edit
          io.to(`user:${otherParticipant}`).emit('dm-edited', editedMessageData);
        }

        // Confirm to sender
        socket.emit('dm-edit-confirmed', editedMessageData);

        console.log(`✅ DM edited successfully: message:${messageId}`);

      } catch (error) {
        console.error('❌ Edit DM error:', error);
        socket.emit('error', { message: 'Failed to edit direct message' });
      }
    });

    // Handle DM deletion
    socket.on('delete-dm', async (data) => {
      console.log(`🗑️ DELETE-DM event received from ${socket.user.username}:`, data);
      try {
        const { messageId } = data;

        if (!messageId) {
          console.log(`❌ Invalid delete-dm data: messageId=${messageId}`);
          socket.emit('error', { message: 'Message ID is required' });
          return;
        }

        const message = await DirectMessage.findById(messageId).populate('conversation');
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        if (message.author.toString() !== socket.userId) {
          socket.emit('error', { message: 'You can only delete your own messages' });
          return;
        }

        // Get the other participant (recipient)
        const otherParticipant = message.conversation.participants.find(
          p => p.toString() !== socket.userId
        );

        message.deleted = true;
        await message.save();

        if (otherParticipant) {
          console.log(`📤 Emitting dm-deleted to user:${otherParticipant}`);
          // Notify the recipient about the deletion
          io.to(`user:${otherParticipant}`).emit('dm-deleted', {
            messageId: messageId
          });
        }

        // Confirm to sender
        socket.emit('dm-delete-confirmed', {
          messageId: messageId
        });

        console.log(`✅ DM deleted successfully: message:${messageId}`);

      } catch (error) {
        console.error('❌ Delete DM error:', error);
        socket.emit('error', { message: 'Failed to delete direct message' });
      }
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

    // Handle friend events
    socket.on('send-friend-request', async (data) => {
      try {
        const { targetUserId } = data;
        
        if (!targetUserId) {
          socket.emit('error', { message: 'Target user ID is required' });
          return;
        }

        // Find the target user and emit friend request notification
        const targetUser = await User.findById(targetUserId);
        if (targetUser) {
          // Emit to target user if they're online
          io.to(`user:${targetUserId}`).emit('friend-request-received', {
            from: {
              id: socket.userId,
              username: socket.user.username,
              avatar: socket.user.avatar
            },
            timestamp: new Date()
          });
        }

      } catch (error) {
        console.error('Send friend request socket error:', error);
        socket.emit('error', { message: 'Failed to send friend request notification' });
      }
    });

    socket.on('accept-friend-request', async (data) => {
      try {
        const { fromUserId } = data;
        
        if (!fromUserId) {
          socket.emit('error', { message: 'From user ID is required' });
          return;
        }

        // Notify the original requester that their request was accepted
        io.to(`user:${fromUserId}`).emit('friend-request-accepted', {
          acceptedBy: {
            id: socket.userId,
            username: socket.user.username,
            avatar: socket.user.avatar
          },
          timestamp: new Date()
        });

        // Notify both users about the new friendship
        const currentUser = await User.findById(socket.userId).select('username avatar status isOnline');
        const friendUser = await User.findById(fromUserId).select('username avatar status isOnline');

        if (currentUser && friendUser) {
          // Notify current user
          socket.emit('friend-added', {
            friend: {
              id: friendUser._id,
              username: friendUser.username,
              avatar: friendUser.avatar,
              status: friendUser.status,
              isOnline: friendUser.isOnline
            }
          });

          // Notify the other user
          io.to(`user:${fromUserId}`).emit('friend-added', {
            friend: {
              id: currentUser._id,
              username: currentUser.username,
              avatar: currentUser.avatar,
              status: currentUser.status,
              isOnline: currentUser.isOnline
            }
          });
        }

      } catch (error) {
        console.error('Accept friend request socket error:', error);
        socket.emit('error', { message: 'Failed to process friend request acceptance' });
      }
    });

    socket.on('decline-friend-request', async (data) => {
      try {
        const { fromUserId } = data;
        
        if (!fromUserId) {
          socket.emit('error', { message: 'From user ID is required' });
          return;
        }

        // Notify the original requester that their request was declined
        io.to(`user:${fromUserId}`).emit('friend-request-declined', {
          declinedBy: {
            id: socket.userId,
            username: socket.user.username
          },
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Decline friend request socket error:', error);
        socket.emit('error', { message: 'Failed to process friend request decline' });
      }
    });

    socket.on('remove-friend', async (data) => {
      try {
        const { friendId } = data;
        
        if (!friendId) {
          socket.emit('error', { message: 'Friend ID is required' });
          return;
        }

        // Notify the removed friend
        io.to(`user:${friendId}`).emit('friend-removed', {
          removedBy: {
            id: socket.userId,
            username: socket.user.username
          },
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Remove friend socket error:', error);
        socket.emit('error', { message: 'Failed to process friend removal' });
      }
    });

    // Enhanced status updates to notify friends
    socket.on('update-status', async (data) => {
      try {
        const { status } = data;
        const validStatuses = ['online', 'away', 'busy', 'offline'];
        
        if (!validStatuses.includes(status)) {
          socket.emit('error', { message: 'Invalid status' });
          return;
        }

        await User.findByIdAndUpdate(socket.userId, { status });

        // Get user with friends and servers
        const user = await User.findById(socket.userId).populate('servers').populate('friends');
        
        // Emit to all servers the user is in
        user.servers.forEach(server => {
          socket.to(`server:${server._id}`).emit('user-status-updated', {
            userId: socket.userId,
            status
          });
        });

        // Emit to all friends
        user.friends.forEach(friend => {
          io.to(`user:${friend._id}`).emit('friend-status-updated', {
            friendId: socket.userId,
            username: socket.user.username,
            status: status,
            isOnline: status !== 'offline'
          });
        });

      } catch (error) {
        console.error('Update status error:', error);
        socket.emit('error', { message: 'Failed to update status' });
      }
    });

    // Handle user activity updates (rich presence)
    socket.on('update-activity', async (data) => {
      try {
        const { activity } = data;
        
        // Validate activity structure
        if (activity && (activity.name || activity.type)) {
          await User.findByIdAndUpdate(socket.userId, { 
            activity: {
              name: activity.name || '',
              type: activity.type || 'playing',
              details: activity.details || '',
              state: activity.state || '',
              timestamps: activity.timestamps || null
            },
            lastSeen: new Date()
          });

          // Get user with friends
          const user = await User.findById(socket.userId).populate('friends');
          
          // Notify friends about activity update
          user.friends.forEach(friend => {
            io.to(`user:${friend._id}`).emit('friend-activity-updated', {
              friendId: socket.userId,
              username: socket.user.username,
              activity: activity,
              timestamp: new Date()
            });
          });

          console.log(`✅ Activity updated for user:${socket.userId}`);
        }

      } catch (error) {
        console.error('Update activity error:', error);
        socket.emit('error', { message: 'Failed to update activity' });
      }
    });

    // Handle last seen updates
    socket.on('update-last-seen', async () => {
      try {
        await User.findByIdAndUpdate(socket.userId, { 
          lastSeen: new Date() 
        });

        // Get user with friends
        const user = await User.findById(socket.userId).populate('friends');
        
        // Notify friends about last seen update
        user.friends.forEach(friend => {
          io.to(`user:${friend._id}`).emit('friend-last-seen-updated', {
            friendId: socket.userId,
            username: socket.user.username,
            lastSeen: new Date()
          });
        });

      } catch (error) {
        console.error('Update last seen error:', error);
        socket.emit('error', { message: 'Failed to update last seen' });
      }
    });

    // Handle voice state updates (for future voice chat implementation)
    socket.on('voice-state-update', async (data) => {
      try {
        const { channelId, muted, deafened, serverId } = data;

        if (serverId) {
          // Emit voice state to all server members
          socket.to(`server:${serverId}`).emit('voice-state-update', {
            userId: socket.userId,
            username: socket.user.username,
            channelId: channelId,
            muted: muted || false,
            deafened: deafened || false,
            timestamp: new Date()
          });

          console.log(`✅ Voice state updated for user:${socket.userId} in server:${serverId}`);
        }

      } catch (error) {
        console.error('Voice state update error:', error);
        socket.emit('error', { message: 'Failed to update voice state' });
      }
    });

    // Handle server leave notifications
    socket.on('leave-server', async (data) => {
      try {
        const { serverId } = data;

        if (serverId) {
          // Notify server members that user left
          socket.to(`server:${serverId}`).emit('member-left', {
            member: {
              id: socket.userId,
              username: socket.user.username,
              avatar: socket.user.avatar
            },
            server: {
              id: serverId
            },
            message: `${socket.user.username} left the server`,
            timestamp: new Date()
          });

          // Leave the server room
          socket.leave(`server:${serverId}`);
          
          console.log(`✅ User ${socket.user.username} left server:${serverId}`);
        }

      } catch (error) {
        console.error('Leave server error:', error);
        socket.emit('error', { message: 'Failed to leave server' });
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

      // Get user with friends and servers
      const user = await User.findById(socket.userId).populate('servers').populate('friends');
      
      // Notify servers about user going offline
      user.servers.forEach(server => {
        socket.to(`server:${server._id}`).emit('user-status-updated', {
          userId: socket.userId,
          status: 'offline',
          isOnline: false
        });
      });

      // Notify friends about user going offline
      user.friends.forEach(friend => {
        io.to(`user:${friend._id}`).emit('friend-status-updated', {
          friendId: socket.userId,
          username: socket.user.username,
          status: 'offline',
          isOnline: false
        });
      });
    });
    
    console.log('✅ All event handlers registered successfully');
  });

  return io;
};

const getIO = () => {
  // Try to get from global first (Next.js API routes)
  if (typeof global !== 'undefined' && global._socketIO) {
    return global._socketIO;
  }
  
  // Fallback to local variable
  if (!io) {
    console.warn('⚠️ Socket.io not initialized yet, skipping emission');
    return null;
  }
  return io;
};

module.exports = { initSocket, getIO };
