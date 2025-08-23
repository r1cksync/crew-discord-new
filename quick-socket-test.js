#!/usr/bin/env node

/**
 * Simple Socket.io Testing Script
 * Run this for quick manual testing of specific features
 */

const io = require('socket.io-client');

// Configuration
const SOCKET_URL = 'http://localhost:3001';
const TEST_TOKEN = 'your-jwt-token-here'; // Replace with actual token

console.log('🧪 Starting Socket.io Quick Test...');

// Connect to socket
const socket = io(SOCKET_URL, {
  auth: {
    token: TEST_TOKEN
  }
});

socket.on('connect', () => {
  console.log('✅ Connected to Socket.io server');
  
  // Test DM sending
  console.log('📤 Testing DM send...');
  socket.emit('send-dm', {
    content: 'Test message from quick test script',
    recipientId: 'RECIPIENT_USER_ID_HERE' // Replace with actual user ID
  });
  
  // Test typing indicator
  console.log('⌨️ Testing typing indicator...');
  socket.emit('dm-typing-start', {
    recipientId: 'RECIPIENT_USER_ID_HERE' // Replace with actual user ID
  });
  
  setTimeout(() => {
    socket.emit('dm-typing-stop', {
      recipientId: 'RECIPIENT_USER_ID_HERE' // Replace with actual user ID
    });
  }, 3000);
  
  // Test status update
  console.log('🟢 Testing status update...');
  socket.emit('update-status', { status: 'busy' });
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection failed:', error.message);
});

// Listen for events
const events = [
  'dm-received', 'dm-sent', 'dm-user-typing', 'dm-user-stopped-typing',
  'dm-read', 'user-status-updated', 'friend-status-updated'
];

events.forEach(event => {
  socket.on(event, (data) => {
    console.log(`📨 Received ${event}:`, JSON.stringify(data, null, 2));
  });
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  socket.disconnect();
  process.exit(0);
});

console.log('🎯 Quick test running... Press Ctrl+C to stop');
console.log('📝 Check console for real-time events');
