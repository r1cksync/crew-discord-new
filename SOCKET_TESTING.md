# Socket.io Real-time Features Testing Guide

This guide covers testing all the real-time Socket.io features implemented in the Discord clone backend.

## 🚀 Quick Start

### Prerequisites
1. Make sure your server is running (`npm run dev`)
2. Ensure Socket.io server is initialized
3. Have test user accounts ready

### Environment Setup
1. Copy `.env.test` to `.env` or configure your environment variables:
```bash
cp .env.test .env
```

2. Update the configuration in `.env`:
```env
API_BASE_URL=http://localhost:3000/api
SOCKET_URL=http://localhost:3001
JWT_SECRET=your-jwt-secret-here
```

## 🧪 Running Tests

### Comprehensive Test Suite
Tests all implemented real-time features automatically:
```bash
npm run test:socket-features
```

### Quick Manual Test
For quick testing of specific features:
```bash
npm run test:socket-quick
```

**Note:** Update `quick-socket-test.js` with actual user tokens and IDs before running.

## 📋 Features Tested

### ✅ Direct Messages (DMs)
- **API-based DM sending** - `/api/direct-messages` endpoint
- **Socket-based DM sending** - `send-dm` event
- **Real-time DM delivery** - `dm-received` event
- **Send confirmations** - `dm-sent` event
- **Typing indicators** - `dm-typing-start/stop` events
- **Read receipts** - `mark-dm-read` and `dm-read` events
- **Message editing** - `edit-dm` and `dm-edited` events
- **Message deletion** - `delete-dm` and `dm-deleted` events

### ✅ Friend System
- **Friend requests** - `friend-request-received` event
- **Request acceptance** - `friend-request-accepted` event
- **Request declining** - `friend-request-declined` event
- **Friend removal** - `friend-removed` event
- **Friend status updates** - `friend-status-updated` event

### ✅ Server Management
- **Server creation** - `server-created` event
- **Member joining** - `member-joined` event
- **Member leaving** - `member-left` event
- **Server invites** - `invite-created` event

### ✅ Moderation Features
- **Member warnings** - `warning-received` and `member-warned` events
- **Member banning** - `member-banned` event
- **Member kicking** - `member-kicked` event
- **Timeout/muting** - `member-timeout` event

### ✅ Channel Features
- **Message sending** - `new-message` event
- **Message editing** - `message-edited` event
- **Message deletion** - `message-deleted` event
- **Typing indicators** - `user-typing` and `user-stopped-typing` events
- **Channel joining/leaving** - `join-channel` and `leave-channel` events

### ✅ Presence & Status
- **Online/offline status** - `user-status-updated` event
- **Custom status updates** - `update-status` event
- **Last seen tracking** - `friend-last-seen-updated` event
- **Activity updates** - Enhanced presence features
- **Voice state updates** - `voice-state-update` event (for future voice chat)

## 🔧 Manual Testing Steps

### 1. Test Direct Messages
```javascript
// Connect two users and test DM functionality
socket1.emit('send-dm', {
  content: 'Hello!',
  recipientId: 'user2_id'
});

// Test typing indicators
socket1.emit('dm-typing-start', { recipientId: 'user2_id' });
socket1.emit('dm-typing-stop', { recipientId: 'user2_id' });

// Test read receipts
socket2.emit('mark-dm-read', {
  messageId: 'message_id',
  senderId: 'user1_id'
});
```

### 2. Test Channel Messages
```javascript
// Join channel and send message
socket.emit('join-channel', 'channel_id');
socket.emit('send-message', {
  content: 'Hello channel!',
  channelId: 'channel_id',
  serverId: 'server_id'
});

// Test typing in channel
socket.emit('typing-start', { channelId: 'channel_id' });
```

### 3. Test Friend System
```javascript
// Send friend request via API then listen for events
// POST /api/friends/request with targetUserId

// Accept friend request via API
// POST /api/friends/accept with requesterId
```

### 4. Test Server Features
```javascript
// Create server via API then listen for events
// POST /api/servers with name and description

// Join server via invite
// POST /api/invites/{code}/join
```

## 📊 Test Results

The comprehensive test script will output:
- ✅ **PASS** - Feature working correctly
- ❌ **FAIL** - Feature not working (with error details)
- **Success Rate** - Percentage of tests passing
- **Detailed Report** - Individual test results

### Sample Output
```
[2025-08-22T10:30:00.000Z] [PASS] DM API Send: PASS - DM sent via API successfully
[2025-08-22T10:30:01.000Z] [PASS] DM Socket Receive: PASS - Received DM: Hello from Socket test!
[2025-08-22T10:30:02.000Z] [PASS] DM Typing Indicator: PASS - TestUser1 is typing
...

=== TEST REPORT ===
Total Tests: 15
Passed: 14
Failed: 1
Success Rate: 93.33%
```

## 🐛 Troubleshooting

### Common Issues

1. **Socket connection fails**
   - Check if server is running
   - Verify JWT token is valid
   - Ensure CORS settings are correct

2. **Events not received**
   - Check user is in correct room (`user:${userId}`)
   - Verify Socket.io is initialized in API routes
   - Check server logs for emission errors

3. **Authentication errors**
   - Ensure test users exist in database
   - Check JWT secret matches server configuration
   - Verify token format in socket auth

### Debug Mode
Add debug logging to socket.js:
```javascript
socket.on('connect', () => {
  console.log(`Debug: User ${socket.user.username} connected`);
});
```

## 🔄 Continuous Testing

For development, you can run tests automatically:
```bash
# Watch mode (if using nodemon)
nodemon test-socket-features.js

# Or run periodically
while true; do npm run test:socket-features; sleep 60; done
```

## 📝 Adding New Tests

To add tests for new features:
1. Add event listeners in `setupSocketListeners()`
2. Create test function following the pattern
3. Add to main test runner
4. Update this README

Example:
```javascript
const testNewFeature = async () => {
  log('=== Testing New Feature ===');
  
  try {
    // Setup listeners
    let eventReceived = false;
    sockets.user2.once('new-event', (data) => {
      eventReceived = true;
      addResult('New Feature', true, `Event received: ${data.message}`);
    });

    // Trigger the feature
    // ... your test code ...

    await sleep(2000);
    addResult('New Feature Test', eventReceived, 'New feature working');

  } catch (error) {
    addResult('New Feature Tests', false, `Test failed: ${error.message}`);
  }
};
```

## 🎯 Performance Testing

For load testing Socket.io features:
```javascript
// Create multiple connections
for (let i = 0; i < 100; i++) {
  // Connect multiple sockets and test performance
}
```

This testing suite ensures all real-time features work correctly and provides confidence in the Socket.io implementation!
