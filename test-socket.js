// Socket.io real-time functionality test
const io = require('socket.io-client');
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

let user1Token, user2Token;
let user1Socket, user2Socket;
let testChannel;

// Generate unique test data to avoid conflicts
const timestamp = Date.now();
const testUsers = [
  {
    username: `socketuser1_${timestamp}`,
    email: `socket1_${timestamp}@example.com`,
    password: 'password123'
  },
  {
    username: `socketuser2_${timestamp}`,
    email: `socket2_${timestamp}@example.com`,
    password: 'password123'
  }
];

async function setupUsers() {
  console.log('👤 Setting up test users...');
  
  try {
    // Register and login users
    const response1 = await axios.post(`${API_BASE}/auth/register`, testUsers[0]);
    user1Token = response1.data.token;
    
    const response2 = await axios.post(`${API_BASE}/auth/register`, testUsers[1]);
    user2Token = response2.data.token;
    
    console.log('   ✅ Test users created');
  } catch (error) {
    console.log('   ❌ Failed to setup users:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function setupServer() {
  console.log('🏢 Setting up test server...');
  
  try {
    // Create server
    const serverResponse = await axios.post(`${API_BASE}/servers`, {
      name: `Socket Test Server ${timestamp}`,
      description: 'Server for testing real-time functionality'
    }, {
      headers: {
        'Authorization': `Bearer ${user1Token}`
      }
    });
    
    const server = serverResponse.data.server;
    testChannel = server.channels.find(channel => channel.type === 'text');
    
    // User 2 joins the server
    await axios.post(`${API_BASE}/servers/join/${server.inviteCode}`, {}, {
      headers: {
        'Authorization': `Bearer ${user2Token}`
      }
    });
    
    console.log('   ✅ Test server setup complete');
    console.log(`   📺 Test channel: ${testChannel.name} (${testChannel._id})`);
  } catch (error) {
    console.log('   ❌ Failed to setup server:', error.response?.data?.error || error.message);
    throw error;
  }
}

function connectSockets() {
  return new Promise((resolve, reject) => {
    console.log('🔌 Connecting Socket.io clients...');
    
    let connectedCount = 0;
    
    // Connect user 1
    user1Socket = io(SOCKET_URL, {
      auth: {
        token: user1Token
      }
    });
    
    user1Socket.on('connect', () => {
      console.log('   ✅ User 1 socket connected');
      connectedCount++;
      if (connectedCount === 2) resolve();
    });
    
    user1Socket.on('connect_error', (error) => {
      console.log('   ❌ User 1 socket connection failed:', error.message);
      reject(error);
    });
    
    // Connect user 2
    user2Socket = io(SOCKET_URL, {
      auth: {
        token: user2Token
      }
    });
    
    user2Socket.on('connect', () => {
      console.log('   ✅ User 2 socket connected');
      connectedCount++;
      if (connectedCount === 2) resolve();
    });
    
    user2Socket.on('connect_error', (error) => {
      console.log('   ❌ User 2 socket connection failed:', error.message);
      reject(error);
    });
    
    // Set timeout
    setTimeout(() => {
      if (connectedCount < 2) {
        reject(new Error('Socket connection timeout'));
      }
    }, 5000);
  });
}

function testRealTimeMessaging() {
  return new Promise((resolve, reject) => {
    console.log('💬 Testing real-time messaging...');
    
    // Clean up any existing listeners first
    user1Socket.removeAllListeners('channel-joined');
    user2Socket.removeAllListeners('channel-joined');
    user2Socket.removeAllListeners('new-message');
    
    let messageReceived = false;
    let user1Joined = false;
    let user2Joined = false;
    
    // User 2 listens for messages
    user2Socket.on('new-message', (message) => {
      console.log('   ✅ Message received by User 2:', message.content);
      console.log('   📧 Message details:', {
        id: message.id,
        channelId: message.channel,
        author: message.author.username
      });
      messageReceived = true;
      
      // Clean up listeners after success
      user1Socket.removeAllListeners('channel-joined');
      user2Socket.removeAllListeners('channel-joined');
      user2Socket.removeAllListeners('new-message');
      
      resolve();
    });
    
    // Wait for both users to join the channel
    console.log('   🔧 Setting up channel-joined event listeners...');
    user1Socket.on('channel-joined', (data) => {
      console.log('   📺 User 1 joined channel:', data.channelId);
      user1Joined = true;
      console.log(`   📊 Join status: User1=${user1Joined}, User2=${user2Joined}`);
      checkAndSendMessage();
    });
    
    user2Socket.on('channel-joined', (data) => {
      console.log('   📺 User 2 joined channel:', data.channelId);
      user2Joined = true;
      console.log(`   📊 Join status: User1=${user1Joined}, User2=${user2Joined}`);
      checkAndSendMessage();
    });
    console.log('   ✅ Event listeners set up, proceeding to join channels...');
    
    function checkAndSendMessage() {
      console.log(`   🔍 checkAndSendMessage called: User1=${user1Joined}, User2=${user2Joined}`);
      if (user1Joined && user2Joined) {
        setTimeout(() => {
          console.log('   📡 Both users joined, sending message...');
          // User 1 sends a message
          user1Socket.emit('send-message', {
            content: 'Hello from Socket.io test!',
            channelId: testChannel._id,
            serverId: testChannel.server
          });
          console.log('   📤 Message send event emitted');
        }, 1000); // Increased delay to ensure both users are fully joined
      } else {
        console.log('   ⏳ Waiting for both users to join...');
      }
    }
    
    // Both users join the channel - add delay to ensure listeners are ready
    setTimeout(() => {
      console.log(`   📡 Emitting join-channel for testChannel._id: ${testChannel._id}`);
      user1Socket.emit('join-channel', testChannel._id);
      user2Socket.emit('join-channel', testChannel._id);
    }, 500); // Add delay to ensure event listeners are set up first
    
    // Set timeout
    setTimeout(() => {
      if (!messageReceived) {
        // Clean up listeners on timeout
        user1Socket.removeAllListeners('channel-joined');
        user2Socket.removeAllListeners('channel-joined');
        user2Socket.removeAllListeners('new-message');
        reject(new Error('Message not received within timeout'));
      }
    }, 12000); // Increased timeout significantly
  });
}

function testTypingIndicators() {
  return new Promise((resolve, reject) => {
    console.log('⌨️  Testing typing indicators...');
    
    // Clean up any existing listeners first
    user1Socket.removeAllListeners('channel-joined');
    user2Socket.removeAllListeners('channel-joined');
    user2Socket.removeAllListeners('user-typing');
    user2Socket.removeAllListeners('user-stopped-typing');
    
    let typingReceived = false;
    let stoppedTypingReceived = false;
    let user1Joined = false;
    let user2Joined = false;
    
    // User 2 listens for typing events
    user2Socket.on('user-typing', (data) => {
      console.log('   ✅ Typing indicator received:', data.username);
      typingReceived = true;
      checkComplete();
    });
    
    user2Socket.on('user-stopped-typing', (data) => {
      console.log('   ✅ Stopped typing indicator received:', data.userId);
      stoppedTypingReceived = true;
      checkComplete();
    });
    
    // Wait for both users to join the channel
    user1Socket.on('channel-joined', (data) => {
      console.log('   📺 User 1 joined channel for typing test:', data.channelId);
      user1Joined = true;
      checkAndStartTyping();
    });
    
    user2Socket.on('channel-joined', (data) => {
      console.log('   📺 User 2 joined channel for typing test:', data.channelId);
      user2Joined = true;
      checkAndStartTyping();
    });
    
    function checkAndStartTyping() {
      if (user1Joined && user2Joined) {
        setTimeout(() => {
          // User 1 starts typing
          console.log(`   📡 Emitting typing-start for channelId: ${testChannel._id}`);
          user1Socket.emit('typing-start', { channelId: testChannel._id });
          
          setTimeout(() => {
            // User 1 stops typing
            console.log(`   📡 Emitting typing-stop for channelId: ${testChannel._id}`);
            user1Socket.emit('typing-stop', { channelId: testChannel._id });
          }, 2000); // Increased delay
        }, 1000);
      }
    }
    
    function checkComplete() {
      if (typingReceived && stoppedTypingReceived) {
        // Clean up listeners after success
        user1Socket.removeAllListeners('channel-joined');
        user2Socket.removeAllListeners('channel-joined');
        user2Socket.removeAllListeners('user-typing');
        user2Socket.removeAllListeners('user-stopped-typing');
        resolve();
      }
    }
    
    // Both users join the channel
    console.log(`   📡 Joining channels for typing test with channelId: ${testChannel._id}`);
    user1Socket.emit('join-channel', testChannel._id);
    user2Socket.emit('join-channel', testChannel._id);
    
    // Set timeout
    setTimeout(() => {
      if (!typingReceived || !stoppedTypingReceived) {
        // Clean up listeners on timeout
        user1Socket.removeAllListeners('channel-joined');
        user2Socket.removeAllListeners('channel-joined');
        user2Socket.removeAllListeners('user-typing');
        user2Socket.removeAllListeners('user-stopped-typing');
        reject(new Error('Typing indicators not received within timeout'));
      }
    }, 12000); // Increased timeout
  });
}

function testStatusUpdates() {
  return new Promise((resolve, reject) => {
    console.log('🟢 Testing status updates...');
    
    let statusUpdateReceived = false;
    
    // User 2 listens for status updates
    user2Socket.on('user-status-updated', (data) => {
      console.log('   ✅ Status update received:', data.status);
      statusUpdateReceived = true;
      resolve();
    });
    
    setTimeout(() => {
      // User 1 updates status
      user1Socket.emit('update-status', { status: 'away' });
    }, 500);
    
    // Set timeout
    setTimeout(() => {
      if (!statusUpdateReceived) {
        reject(new Error('Status update not received within timeout'));
      }
    }, 3000);
  });
}

function testMessageEditing() {
  return new Promise((resolve, reject) => {
    console.log('✏️  Testing message editing...');
    
    let messageId = null;
    let messageEdited = false;
    let originalMessageReceived = false;
    
    // User 2 listens for message events
    user2Socket.on('new-message', (message) => {
      if (!originalMessageReceived) {
        messageId = message.id;
        originalMessageReceived = true;
        console.log('   📝 Original message received:', message.content);
        
        setTimeout(() => {
          // User 1 edits the message
          user1Socket.emit('edit-message', {
            messageId: messageId,
            content: 'This message has been edited!'
          });
        }, 1000);
      }
    });
    
    user2Socket.on('message-edited', (data) => {
      console.log('   ✅ Message edit received:', data.content);
      messageEdited = true;
      resolve();
    });
    
    setTimeout(() => {
      // User 1 sends a message to edit
      user1Socket.emit('send-message', {
        content: 'This message will be edited',
        channelId: testChannel._id,
        serverId: testChannel.server
      });
    }, 500);
    
    // Set timeout
    setTimeout(() => {
      if (!messageEdited) {
        reject(new Error('Message edit not received within timeout'));
      }
    }, 10000); // Increased timeout
  });
}

function disconnectSockets() {
  console.log('🔌 Disconnecting sockets...');
  
  if (user1Socket) {
    user1Socket.disconnect();
    console.log('   ✅ User 1 socket disconnected');
  }
  
  if (user2Socket) {
    user2Socket.disconnect();
    console.log('   ✅ User 2 socket disconnected');
  }
}

async function runSocketTests() {
  console.log('🚀 Starting Socket.io Real-time Tests...\n');
  
  const tests = [
    { name: 'Setup Users', fn: setupUsers },
    { name: 'Setup Server', fn: setupServer },
    { name: 'Connect Sockets', fn: connectSockets },
    { name: 'Real-time Messaging', fn: testRealTimeMessaging },
    { name: 'Typing Indicators', fn: testTypingIndicators },
    { name: 'Status Updates', fn: testStatusUpdates },
    { name: 'Message Editing', fn: testMessageEditing }
  ];
  
  let passedTests = 0;
  let failedTests = 0;
  
  try {
    for (const test of tests) {
      try {
        await test.fn();
        console.log(`✅ ${test.name} - PASSED\n`);
        passedTests++;
      } catch (error) {
        console.log(`❌ ${test.name} - FAILED: ${error.message}\n`);
        failedTests++;
        
        // If critical tests fail, stop
        if (['Setup Users', 'Setup Server', 'Connect Sockets'].includes(test.name)) {
          break;
        }
      }
    }
  } finally {
    disconnectSockets();
  }
  
  console.log('📊 Socket.io Test Results:');
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log(`   📈 Success Rate: ${((passedTests / tests.length) * 100).toFixed(1)}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 All Socket.io tests passed! Real-time functionality is working!');
  } else {
    console.log('\n⚠️  Some Socket.io tests failed. Check server status and try again.');
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  runSocketTests().catch(console.error);
}

module.exports = runSocketTests;
