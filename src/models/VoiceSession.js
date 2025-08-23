const mongoose = require('mongoose');

const voiceSessionSchema = new mongoose.Schema({
  // Session identification
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Session type: 'channel' for server voice channels, 'dm' for direct message calls
  type: {
    type: String,
    enum: ['channel', 'dm'],
    required: true
  },
  
  // For channel voice sessions
  channel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel'
  },
  
  server: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server'
  },
  
  // For DM voice sessions
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Current active users in the session
  activeUsers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    // Voice/video states
    isMuted: {
      type: Boolean,
      default: false
    },
    isDeafened: {
      type: Boolean,
      default: false
    },
    isVideoEnabled: {
      type: Boolean,
      default: false
    },
    isScreenSharing: {
      type: Boolean,
      default: false
    },
    // WebRTC connection info
    peerId: String,
    socketId: String
  }],
  
  // Session settings
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Recording settings (for future implementation)
  isRecording: {
    type: Boolean,
    default: false
  },
  
  // Session limits
  maxParticipants: {
    type: Number,
    default: 50 // Discord-like limit
  },
  
  // Session metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  startedAt: {
    type: Date,
    default: Date.now
  },
  
  endedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better performance
voiceSessionSchema.index({ sessionId: 1 });
voiceSessionSchema.index({ channel: 1 });
voiceSessionSchema.index({ participants: 1 });
voiceSessionSchema.index({ isActive: 1 });

// Methods
voiceSessionSchema.methods.addUser = function(userId, socketId, peerId) {
  const existingUser = this.activeUsers.find(u => u.user.toString() === userId.toString());
  
  if (!existingUser) {
    this.activeUsers.push({
      user: userId,
      socketId,
      peerId,
      joinedAt: new Date()
    });
  } else {
    // Update existing user's connection info
    existingUser.socketId = socketId;
    existingUser.peerId = peerId;
    existingUser.joinedAt = new Date();
  }
  
  return this.save();
};

voiceSessionSchema.methods.removeUser = function(userId) {
  this.activeUsers = this.activeUsers.filter(u => u.user.toString() !== userId.toString());
  
  // End session if no active users
  if (this.activeUsers.length === 0) {
    this.isActive = false;
    this.endedAt = new Date();
  }
  
  return this.save();
};

voiceSessionSchema.methods.updateUserState = function(userId, updates) {
  const user = this.activeUsers.find(u => u.user.toString() === userId.toString());
  
  if (user) {
    Object.assign(user, updates);
    return this.save();
  }
  
  return Promise.resolve(this);
};

module.exports = mongoose.models.VoiceSession || mongoose.model('VoiceSession', voiceSessionSchema);
