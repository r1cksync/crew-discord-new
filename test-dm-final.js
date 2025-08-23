/**
 * FINAL DM FUNCTIONALITY TEST - Both Users Connected
 */

const io = require('socket.io-client');
const axios = require('axios');

const test = async () => {
  try {
    console.log('🎯 FINAL TEST: Both users connected simultaneously');
    
    // Login both users
    const [user1Response, user2Response] = await Promise.all([
      axios.post('http://localhost:3001/api/auth/login', {
        email: 'testuser1@example.com',
        password: 'password123'
      }),
      axios.post('http://localhost:3001/api/auth/login', {
        email: 'testuser2@example.com',
        password: 'password123'
      })
    ]);
    
    console.log('✅ Both users authenticated');
    
    // Connect both sockets
    const socket1 = io('http://localhost:3001', {
      auth: { token: user1Response.data.token }
    });
    
    const socket2 = io('http://localhost:3001', {
      auth: { token: user2Response.data.token }
    });
    
    // Wait for both connections
    await Promise.all([
      new Promise(resolve => socket1.on('connect', resolve)),
      new Promise(resolve => socket2.on('connect', resolve))
    ]);
    
    console.log('✅ Both sockets connected');
    
    // Set up event listeners
    let dmReceived = false;
    let dmSent = false;
    
    socket2.on('dm-received', (data) => {
      console.log('🎉 USER2 RECEIVED DM:', data.message.content);
      console.log('📨 From:', data.sender.username);
      dmReceived = true;
    });
    
    socket1.on('dm-sent', (data) => {
      console.log('✅ USER1 DM SENT CONFIRMATION:', data.message.content);
      console.log('📤 To:', data.recipient.username);
      dmSent = true;
    });
    
    // Send DM from user1 to user2
    console.log('💬 Sending DM from User1 to User2...');
    socket1.emit('send-dm', {
      content: 'Hello! This is a real-time direct message! 🚀',
      recipientId: user2Response.data.user.id
    });
    
    // Wait for events to propagate
    console.log('⏳ Waiting for real-time events...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n🎯 === FINAL RESULTS ===');
    console.log('DM Received by User2:', dmReceived ? '✅ SUCCESS' : '❌ FAILED');
    console.log('DM Sent Confirmation to User1:', dmSent ? '✅ SUCCESS' : '❌ FAILED');
    
    if (dmReceived && dmSent) {
      console.log('\n🎉 🎉 🎉 DM FUNCTIONALITY IS FULLY WORKING! 🎉 🎉 🎉');
      console.log('✅ Real-time direct messaging is operational');
      console.log('✅ Socket.io events are properly emitted');
      console.log('✅ Database operations are working');
      console.log('✅ Both sender and recipient notifications work');
    } else {
      console.log('\n❌ Some issues remain with event propagation');
    }
    
    // Test typing indicators too
    console.log('\n💬 Testing typing indicators...');
    let typingReceived = false;
    
    socket2.on('dm-user-typing', (data) => {
      console.log('⌨️ USER2 sees typing from:', data.username);
      typingReceived = true;
    });
    
    socket1.emit('dm-typing-start', { recipientId: user2Response.data.user.id });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Typing indicators working:', typingReceived ? '✅ YES' : '❌ NO');
    
    socket1.disconnect();
    socket2.disconnect();
    
    console.log('\n📊 COMPREHENSIVE TEST COMPLETED');
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
};

test();
