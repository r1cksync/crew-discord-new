const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  channel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    required: true
  },
  server: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server'
  },
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    contentType: String
  }],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  reactions: [{
    emoji: String,
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }],
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  pinned: {
    type: Boolean,
    default: false
  },
  deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
