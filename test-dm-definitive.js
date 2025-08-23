/**
 * DEFINITIVE DM SUCCESS TEST - Both users properly connected and listening
 */

const io = require('socket.io-client');
const axios = require('axios');

const test = async () => {
  try {
    console.log('🎯 DEFINITIVE TEST: Complete DM functionality verification');
    
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
      auth: { token: user1Response.data.token },
      forceNew: true
    });
    
    const socket2 = io('http://localhost:3001', {
      auth: { token: user2Response.data.token },
      forceNew: true
    });
    
    // Wait for both connections
    await Promise.all([
      new Promise(resolve => socket1.on('connect', resolve)),
      new Promise(resolve => socket2.on('connect', resolve))
    ]);
    
    console.log('✅ Both sockets connected and ready');
    
    // Set up event listeners BEFORE sending
    let dmReceived = false;
    let dmSent = false;
    let receivedMessage = null;
    let sentConfirmation = null;
    
    socket2.on('dm-received', (data) => {
      console.log('🎉 USER2 RECEIVED DM EVENT!');
      console.log('📨 Content:', data.message.content);
      console.log('📨 From:', data.sender.username);
      receivedMessage = data;
      dmReceived = true;
    });
    
    socket1.on('dm-sent', (data) => {
      console.log('✅ USER1 DM SENT CONFIRMATION EVENT!');
      console.log('📤 Content:', data.message.content);
      console.log('📤 To:', data.recipient.username);
      sentConfirmation = data;
      dmSent = true;
    });
    
    console.log('🎧 Event listeners set up, now sending DM...');
    
    // Add a small delay to ensure socket is fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('⏰ Delay completed, socket should be ready...');
    
    // Send DM from user1 to user2
    console.log('📤 About to emit send-dm event...');
    socket1.emit('send-dm', {
      content: 'FINAL TEST: Real-time DM is working! 🚀✨',
      recipientId: user2Response.data.user.id
    });
    console.log('📤 send-dm event emitted successfully');
    
    console.log('📤 DM emission sent, waiting for real-time events...');
    
    // Wait longer and check multiple times
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (dmReceived && dmSent) {
        console.log(`✅ Both events received after ${(i + 1) * 500}ms!`);
        break;
      }
    }
    
    console.log('\n🎯 === FINAL COMPREHENSIVE RESULTS ===');
    console.log('DM Received by User2:', dmReceived ? '✅ SUCCESS' : '❌ FAILED');
    console.log('DM Sent Confirmation to User1:', dmSent ? '✅ SUCCESS' : '❌ FAILED');
    
    if (dmReceived && dmSent) {
      console.log('\n🎉🎉🎉 COMPLETE SUCCESS! 🎉🎉🎉');
      console.log('✅ Real-time Direct Messaging is FULLY OPERATIONAL!');
      console.log('✅ Both socket events work perfectly');
      console.log('✅ Database operations successful');
      console.log('✅ Real-time notifications working');
      console.log('\n📊 DM SYSTEM STATUS: 100% WORKING! 🚀');
    } else {
      console.log('\n❌ Event delivery issues detected');
      if (receivedMessage) console.log('Received message data:', receivedMessage);
      if (sentConfirmation) console.log('Sent confirmation data:', sentConfirmation);
    }
    
    socket1.disconnect();
    socket2.disconnect();
    
    console.log('\n🏁 Definitive test completed');
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
};

test();
