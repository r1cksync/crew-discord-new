const mongoose = require('mongoose');

const directMessageSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  messages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DirectMessage'
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DirectMessage'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const directMessageContentSchema = new mongoose.Schema({
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
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DirectMessageConversation',
    required: true
  },
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    contentType: String
  }],
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const DirectMessageConversation = mongoose.models.DirectMessageConversation || mongoose.model('DirectMessageConversation', directMessageSchema);
const DirectMessage = mongoose.models.DirectMessage || mongoose.model('DirectMessage', directMessageContentSchema);

module.exports = { DirectMessageConversation, DirectMessage };
