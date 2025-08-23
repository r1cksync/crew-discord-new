/**
 * Minimal DM Test - Debug DM sending issue
 */

const io = require('socket.io-client');
const axios = require('axios');
require('dotenv').config();

const SOCKET_URL = 'http://localhost:3001';

// Use existing user tokens (get from login)
let user1Token, user2Token, user1Id, user2Id;

const test = async () => {
  try {
    console.log('🔐 Authenticating users...');
    
    // Login user1
    const user1Response = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'testuser1@example.com',
      password: 'password123'
    });
    user1Token = user1Response.data.token;
    user1Id = user1Response.data.user.id;
    console.log('✅ User1 authenticated:', user1Id);
    
    // Login user2  
    const user2Response = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'testuser2@example.com', 
      password: 'password123'
    });
    user2Token = user2Response.data.token;
    user2Id = user2Response.data.user.id;
    console.log('✅ User2 authenticated:', user2Id);

    console.log('🔌 Connecting sockets...');
    
    // Connect user1 socket
    const socket1 = io(SOCKET_URL, {
      auth: { token: user1Token }
    });
    
    // Connect user2 socket  
    const socket2 = io(SOCKET_URL, {
      auth: { token: user2Token }
    });

    // Wait for connections
    await new Promise((resolve) => {
      let connected = 0;
      socket1.on('connect', () => {
        console.log('✅ Socket1 connected');
        connected++;
        if (connected === 2) resolve();
      });
      socket2.on('connect', () => {
        console.log('✅ Socket2 connected');
        connected++;
        if (connected === 2) resolve();
      });
    });

    // Set up listeners
    socket2.on('dm-received', (data) => {
      console.log('📨 User2 received DM:', data.message.content);
    });
    
    socket1.on('dm-sent', (data) => {
      console.log('✅ User1 DM sent confirmation:', data.message.content);
    });

    socket1.on('error', (error) => {
      console.error('❌ Socket1 error:', error);
    });

    socket2.on('error', (error) => {
      console.error('❌ Socket2 error:', error);
    });

    console.log('💬 Sending DM...');
    console.log('From:', user1Id);
    console.log('To:', user2Id);
    
    // Send DM
    socket1.emit('send-dm', {
      content: 'Debug test message',
      recipientId: user2Id
    });

    // Wait and see what happens
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🏁 Test completed');
    socket1.disconnect();
    socket2.disconnect();

  } catch (error) {
    console.error('💥 Test failed:', error.response?.data || error.message);
  }
};

test();
