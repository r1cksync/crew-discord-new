/**
 * Minimal DM Debug Test - Find exactly what's wrong
 */

const io = require('socket.io-client');
const axios = require('axios');

const test = async () => {
  try {
    console.log('🔍 MINIMAL DEBUG TEST - DM Event Investigation');
    
    // Login
    const userResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'testuser1@example.com',
      password: 'password123'
    });
    
    console.log('✅ User authenticated');
    
    // Connect socket with debug
    const socket = io('http://localhost:3001', {
      auth: { token: userResponse.data.token },
      forceNew: true
    });
    
    // Wait for connection
    await new Promise(resolve => socket.on('connect', resolve));
    console.log('✅ Socket connected');
    
    // Test 1: Basic event that we know works
    console.log('\n🧪 TEST 1: Testing working event (dm-typing-start)');
    socket.emit('dm-typing-start', { recipientId: '68a77049702a35fd70fe7618' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: The problematic send-dm event
    console.log('\n🧪 TEST 2: Testing problematic event (send-dm)');
    console.log('📤 About to emit send-dm event...');
    
    socket.emit('send-dm', {
      content: 'Debug test message',
      recipientId: '68a77049702a35fd70fe7618'
    });
    
    console.log('📤 send-dm event emitted, waiting for server response...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 3: Try alternative event name to see if it's a naming issue
    console.log('\n🧪 TEST 3: Testing with different event name');
    socket.emit('test-dm', {
      content: 'Alternative test',
      recipientId: '68a77049702a35fd70fe7618'
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('\n🏁 Debug test completed - Check server logs for which events were received');
    
    socket.disconnect();
    
  } catch (error) {
    console.error('💥 Debug test failed:', error.message);
  }
};

test();
