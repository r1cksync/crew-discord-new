const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  color: {
    type: String,
    default: '#99aab5'
  },
  permissions: [{
    type: String,
    enum: [
      'ADMINISTRATOR',
      'MANAGE_CHANNELS',
      'MANAGE_ROLES',
      'MANAGE_MESSAGES',
      'KICK_MEMBERS',
      'BAN_MEMBERS',
      'SEND_MESSAGES',
      'READ_MESSAGES',
      'CONNECT',
      'SPEAK',
      'MUTE_MEMBERS',
      'DEAFEN_MEMBERS',
      'MOVE_MEMBERS'
    ]
  }],
  server: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server',
    required: true
  },
  position: {
    type: Number,
    default: 0
  },
  mentionable: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.Role || mongoose.model('Role', roleSchema);
