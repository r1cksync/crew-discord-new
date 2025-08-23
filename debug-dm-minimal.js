/**
 * Minimal DM Test - Debug the send-dm socket event
 */

const io = require('socket.io-client');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

// Use existing test users
const loginUser = async (email, password) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password
    });
    return response.data;
  } catch (error) {
    console.log('Login failed, error:', error.response?.data);
    throw error;
  }
};

const testDM = async () => {
  console.log('🔍 Starting minimal DM test...');
  
  try {
    // Login both users
    console.log('📝 Logging in users...');
    const user1Data = await loginUser('testuser1@example.com', 'password123');
    const user2Data = await loginUser('testuser2@example.com', 'password123');
    
    console.log('✅ Users logged in');
    console.log('User1 ID:', user1Data.user.id);
    console.log('User2 ID:', user2Data.user.id);

    // Connect socket for user1
    console.log('🔌 Connecting user1 socket...');
    const socket1 = io(SOCKET_URL, {
      auth: { token: user1Data.token }
    });

    // Connect socket for user2  
    console.log('🔌 Connecting user2 socket...');
    const socket2 = io(SOCKET_URL, {
      auth: { token: user2Data.token }
    });

    // Wait for connections
    await new Promise((resolve) => {
      let connected = 0;
      
      socket1.on('connect', () => {
        console.log('✅ User1 socket connected');
        connected++;
        if (connected === 2) resolve();
      });
      
      socket2.on('connect', () => {
        console.log('✅ User2 socket connected');
        connected++;
        if (connected === 2) resolve();
      });
    });

    // Set up event listeners
    socket2.on('dm-received', (data) => {
      console.log('📨 User2 received DM:', data);
    });

    socket1.on('dm-sent', (data) => {
      console.log('✅ User1 got send confirmation:', data);
    });

    socket1.on('error', (error) => {
      console.log('❌ User1 socket error:', error);
    });

    socket2.on('error', (error) => {
      console.log('❌ User2 socket error:', error);
    });

    // Wait a moment for setup
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send DM
    console.log('📤 Sending DM from user1 to user2...');
    socket1.emit('send-dm', {
      content: 'Hello from debug test!',
      recipientId: user2Data.user.id
    });

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Cleanup
    socket1.disconnect();
    socket2.disconnect();
    
    console.log('🏁 Test completed');

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
};

testDM();
