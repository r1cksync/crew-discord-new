/**
 * Test Socket Room Targeting - Debug IO emissions
 */

const io = require('socket.io-client');
const axios = require('axios');

const test = async () => {
  try {
    console.log('🔍 DEBUGGING: Socket room targeting and IO emissions');
    
    // Login user
    const userResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'testuser1@example.com',
      password: 'password123'
    });
    
    console.log('✅ User authenticated');
    
    // Connect socket
    const socket = io('http://localhost:3001', {
      auth: { token: userResponse.data.token },
      forceNew: true
    });
    
    await new Promise(resolve => socket.on('connect', resolve));
    console.log('✅ Socket connected');
    
    // Listen for ANY events coming to this socket
    socket.onAny((eventName, ...args) => {
      console.log(`📡 RECEIVED EVENT: ${eventName}`, args);
    });
    
    // Test the room emission by sending to our own user room
    console.log('\n🧪 Testing room emission to self...');
    socket.emit('send-dm', {
      content: 'Self-test message',
      recipientId: userResponse.data.user.id  // Send to ourselves
    });
    
    console.log('⏳ Waiting for any events (including self-emission)...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n🏁 Room targeting test completed');
    socket.disconnect();
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
};

test();
