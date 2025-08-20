const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  icon: {
    type: String,
    default: null
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    roles: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role'
    }],
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  channels: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel'
  }],
  roles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role'
  }],
  inviteCode: {
    type: String,
    unique: true,
    sparse: true
  },
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Generate invite code before saving
serverSchema.pre('save', function(next) {
  if (!this.inviteCode) {
    this.inviteCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  next();
});

module.exports = mongoose.models.Server || mongoose.model('Server', serverSchema);
