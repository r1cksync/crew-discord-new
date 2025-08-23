/**
 * Debug Socket Event Reception
 */

const io = require('socket.io-client');
const axios = require('axios');

const test = async () => {
  try {
    console.log('🔌 Testing socket event reception...');
    
    // Login user1
    const user1 = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'testuser1@example.com',
      password: 'password123'
    });
    
    const user2 = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'testuser2@example.com',
      password: 'password123'
    });
    
    console.log('✅ Authentication successful');
    
    // Connect socket1
    const socket1 = io('http://localhost:3001', {
      auth: { token: user1.data.token }
    });
    
    // Wait for connection
    await new Promise((resolve, reject) => {
      socket1.on('connect', () => {
        console.log('✅ Socket1 connected with ID:', socket1.id);
        resolve();
      });
      
      socket1.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        reject(error);
      });
      
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
    
    // Test basic communication first
    console.log('🧪 Testing basic socket communication...');
    
    // Test status update (we know this works)
    socket1.emit('update-status', { status: 'busy' });
    console.log('✅ Status update sent');
    
    // Test typing indicator (we know this works)
    socket1.emit('dm-typing-start', { recipientId: user2.data.user.id });
    console.log('✅ Typing indicator sent');
    
    // Now test DM sending with detailed logging
    console.log('💬 Testing DM sending...');
    console.log('From User ID:', user1.data.user.id);
    console.log('To User ID:', user2.data.user.id);
    
    // Add error listener
    socket1.on('error', (error) => {
      console.error('❌ Socket error received:', error);
    });
    
    // Try to send DM
    console.log('📤 Emitting send-dm event...');
    socket1.emit('send-dm', {
      content: 'Debug DM test',
      recipientId: user2.data.user.id
    });
    
    console.log('⏰ Waiting for response...');
    
    // Wait longer to see if anything happens
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🏁 Test completed');
    socket1.disconnect();
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
};

test();
