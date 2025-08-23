/**
 * Test if send-dm event handler is reachable
 */

const io = require('socket.io-client');
const axios = require('axios');

const test = async () => {
  try {
    console.log('🔍 Testing if send-dm event handler is reachable...');
    
    // Login user
    const user1 = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'testuser1@example.com',
      password: 'password123'
    });
    
    console.log('✅ Authentication successful');
    
    // Connect socket
    const socket1 = io('http://localhost:3001', {
      auth: { token: user1.data.token }
    });
    
    // Wait for connection
    await new Promise((resolve) => {
      socket1.on('connect', resolve);
    });
    
    console.log('✅ Socket connected');
    
    // Listen for any errors
    socket1.on('error', (error) => {
      console.log('🔔 Received error event:', error);
    });
    
    // Test: Send a simple ping first to verify socket works
    console.log('📡 Testing basic socket communication with status update...');
    socket1.emit('update-status', { status: 'online' });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('💬 Now testing send-dm event...');
    console.log('📤 Emitting send-dm event...');
    
    // Send DM with minimal data
    socket1.emit('send-dm', {
      content: 'Test',
      recipientId: '68a77049702a35fd70fe7618'
    });
    
    // Wait longer to see if anything happens
    console.log('⏳ Waiting 5 seconds for any response...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🏁 Test completed');
    socket1.disconnect();
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
};

test();
