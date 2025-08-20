const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ['text', 'voice', 'category'],
    default: 'text'
  },
  server: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel'
  },
  position: {
    type: Number,
    default: 0
  },
  permissions: [{
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role'
    },
    allow: [String],
    deny: [String]
  }],
  isPrivate: {
    type: Boolean,
    default: false
  },
  topic: {
    type: String,
    maxlength: 1000
  },
  slowMode: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.Channel || mongoose.model('Channel', channelSchema);
