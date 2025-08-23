/**
 * Test DM after fixing imports
 */

const io = require('socket.io-client');
const axios = require('axios');

const test = async () => {
  try {
    console.log('🧪 Testing DM after import fixes...');
    
    // Login users
    const user1 = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'testuser1@example.com',
      password: 'password123'
    });
    
    const user2 = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'testuser2@example.com',
      password: 'password123'
    });
    
    console.log('✅ Authentication successful');
    
    // Connect sockets
    const socket1 = io('http://localhost:3001', {
      auth: { token: user1.data.token }
    });
    
    const socket2 = io('http://localhost:3001', {
      auth: { token: user2.data.token }
    });
    
    // Wait for connections
    await new Promise((resolve) => {
      let connected = 0;
      socket1.on('connect', () => {
        connected++;
        if (connected === 2) resolve();
      });
      socket2.on('connect', () => {
        connected++;
        if (connected === 2) resolve();
      });
    });
    
    console.log('✅ Sockets connected');
    
    // Listen for DM events
    let dmReceived = false;
    let dmSent = false;
    
    socket2.on('dm-received', (data) => {
      console.log('📨 DM RECEIVED:', data.message.content);
      dmReceived = true;
    });
    
    socket1.on('dm-sent', (data) => {
      console.log('✅ DM SENT CONFIRMATION:', data.message.content);
      dmSent = true;
    });
    
    socket1.on('error', (error) => {
      console.error('❌ Socket1 error:', error);
    });
    
    // Send DM
    console.log('💬 Sending DM...');
    socket1.emit('send-dm', {
      content: 'Test message after fixing imports!',
      recipientId: user2.data.user.id
    });
    
    // Wait for result
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📊 Results:');
    console.log('DM Received:', dmReceived ? '✅ YES' : '❌ NO');
    console.log('DM Sent Confirmation:', dmSent ? '✅ YES' : '❌ NO');
    
    if (dmReceived && dmSent) {
      console.log('🎉 DM FUNCTIONALITY IS NOW WORKING!');
    } else {
      console.log('❌ DM functionality still has issues');
    }
    
    socket1.disconnect();
    socket2.disconnect();
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
};

test();
