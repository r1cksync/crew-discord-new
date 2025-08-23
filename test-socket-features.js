/**
 * Comprehensive Socket.io Real-time Features Testing Script
 * Tests all implemented real-time functionality including:
 * - Direct Messages (DMs)
 * - Server Management
 * - Moderation Features
 * - Friend Requests
 * - Typing Indicators
 * - Presence/Status Updates
 */

const io = require('socket.io-client');
const axios = require('axios');
require('dotenv').config();

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3001';

// Test users (you'll need to create these or use existing ones)
const TEST_USERS = {
  user1: {
    email: 'testuser1@example.com',
    password: 'password123',
    username: 'TestUser1'
  },
  user2: {
    email: 'testuser2@example.com', 
    password: 'password123',
    username: 'TestUser2'
  }
};

let tokens = {};
let sockets = {};
let testResults = [];

// Utility functions
const log = (message, type = 'INFO') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}] ${message}`);
};

const addResult = (test, passed, message) => {
  testResults.push({ test, passed, message, timestamp: new Date() });
  log(`${test}: ${passed ? 'PASS' : 'FAIL'} - ${message}`, passed ? 'PASS' : 'FAIL');
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Authentication helper
const authenticateUser = async (userKey) => {
  try {
    const user = TEST_USERS[userKey];
    
    // Try to login first
    let response;
    try {
      log(`Attempting login for ${userKey}...`);
      response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: user.email,
        password: user.password
      });
      log(`Login successful for ${userKey}`);
    } catch (loginError) {
      // If login fails, try to register
      log(`Login failed for ${userKey}: ${loginError.response?.data?.error || loginError.message}, attempting registration...`);
      try {
        await axios.post(`${API_BASE_URL}/auth/register`, {
          username: user.username,
          email: user.email,
          password: user.password
        });
        log(`Registration successful for ${userKey}, now logging in...`);
        
        // Now login
        response = await axios.post(`${API_BASE_URL}/auth/login`, {
          email: user.email,
          password: user.password
        });
        log(`Login after registration successful for ${userKey}`);
      } catch (registerError) {
        log(`Registration failed for ${userKey}: ${registerError.response?.data?.error || registerError.message}`, 'ERROR');
        throw registerError;
      }
    }

    tokens[userKey] = response.data.token;
    log(`Authenticated ${userKey} successfully`);
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
    log(`Authentication failed for ${userKey}: ${errorMsg}`, 'ERROR');
    throw error;
  }
};

// Socket connection helper
const connectSocket = (userKey) => {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      auth: {
        token: tokens[userKey]
      }
    });

    socket.on('connect', () => {
      log(`Socket connected for ${userKey}`);
      sockets[userKey] = socket;
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      log(`Socket connection failed for ${userKey}: ${error.message}`, 'ERROR');
      reject(error);
    });

    // Set up event listeners for testing
    setupSocketListeners(socket, userKey);
  });
};

// Set up socket event listeners for testing
const setupSocketListeners = (socket, userKey) => {
  const events = [
    'dm-received', 'dm-sent', 'dm-user-typing', 'dm-user-stopped-typing',
    'dm-read', 'dm-edited', 'dm-deleted', 'friend-request-received',
    'friend-request-accepted', 'friend-request-declined', 'friend-removed',
    'server-created', 'server-joined', 'member-joined', 'member-banned',
    'member-kicked', 'warning-received', 'member-warned', 'invite-created',
    'user-typing', 'user-stopped-typing', 'new-message', 'message-edited',
    'message-deleted', 'user-status-updated', 'friend-status-updated'
  ];

  events.forEach(event => {
    socket.on(event, (data) => {
      log(`${userKey} received ${event}: ${JSON.stringify(data)}`);
    });
  });

  socket.on('error', (error) => {
    log(`${userKey} socket error: ${JSON.stringify(error)}`, 'ERROR');
  });
};

// Test Direct Messages
const testDirectMessages = async () => {
  log('=== Testing Direct Messages ===');
  
  try {
    // Test 1: Send DM via API
    const dmResponse = await axios.post(`${API_BASE_URL}/direct-messages`, {
      content: 'Hello from API test!',
      recipientId: tokens.user2_data.user.id
    }, {
      headers: { Authorization: `Bearer ${tokens.user1}` }
    });

    addResult('DM API Send', dmResponse.data.success, 'DM sent via API successfully');
    await sleep(1000);

    // Test 2: Send DM via Socket
    let dmSocketReceived = false;
    sockets.user2.once('dm-received', (data) => {
      dmSocketReceived = true;
      addResult('DM Socket Receive', true, `Received DM: ${data.message.content}`);
    });

    sockets.user1.emit('send-dm', {
      content: 'Hello from Socket test!',
      recipientId: tokens.user2_data.user.id
    });

    await sleep(2000);
    addResult('DM Socket Send', dmSocketReceived, 'DM received via socket event');

    // Test 3: DM Typing Indicators
    let typingReceived = false;
    sockets.user2.once('dm-user-typing', (data) => {
      typingReceived = true;
      addResult('DM Typing Indicator', true, `${data.username} is typing`);
    });

    sockets.user1.emit('dm-typing-start', { recipientId: tokens.user2_data.user.id });
    await sleep(1000);
    sockets.user1.emit('dm-typing-stop', { recipientId: tokens.user2_data.user.id });

    await sleep(1000);
    addResult('DM Typing Test', typingReceived, 'Typing indicators working');

    // Test 4: DM Read Receipts (need to get message ID from API)
    const messagesResponse = await axios.get(`${API_BASE_URL}/direct-messages?recipient=${tokens.user1_data.user.id}`, {
      headers: { Authorization: `Bearer ${tokens.user2}` }
    });

    if (messagesResponse.data.messages && messagesResponse.data.messages.length > 0) {
      const messageId = messagesResponse.data.messages[0].id;
      
      let readReceiptReceived = false;
      sockets.user1.once('dm-read', (data) => {
        readReceiptReceived = true;
        addResult('DM Read Receipt', true, `Message read by ${data.readBy.username}`);
      });

      sockets.user2.emit('mark-dm-read', {
        messageId: messageId,
        senderId: tokens.user1_data.user.id
      });

      await sleep(1000);
      addResult('DM Read Receipt Test', readReceiptReceived, 'Read receipts working');
    }

  } catch (error) {
    addResult('DM Tests', false, `DM test failed: ${error.message}`);
  }
};

// Test Friend Requests
const testFriendRequests = async () => {
  log('=== Testing Friend Requests ===');
  
  try {
    let friendRequestReceived = false;
    sockets.user2.once('friend-request-received', (data) => {
      friendRequestReceived = true;
      addResult('Friend Request Received', true, `Friend request from ${data.from.username}`);
    });

    // Send friend request
    const friendRequestResponse = await axios.post(`${API_BASE_URL}/users/${tokens.user2_data.user.id}/friend-request`, {}, {
      headers: { Authorization: `Bearer ${tokens.user1}` }
    });

    await sleep(2000);
    addResult('Friend Request Send', friendRequestReceived && friendRequestResponse.data.success, 'Friend request sent and received');

    // Accept friend request
    let friendRequestAccepted = false;
    sockets.user1.once('friend-request-accepted', (data) => {
      friendRequestAccepted = true;
      addResult('Friend Request Accepted', true, `Friend request accepted by ${data.acceptedBy.username}`);
    });

    const acceptResponse = await axios.post(`${API_BASE_URL}/friends/accept`, {
      requesterId: tokens.user1_data.user.id
    }, {
      headers: { Authorization: `Bearer ${tokens.user2}` }
    });

    await sleep(2000);
    addResult('Friend Request Accept', friendRequestAccepted && acceptResponse.data.success, 'Friend request accepted');

  } catch (error) {
    addResult('Friend Request Tests', false, `Friend request test failed: ${error.message}`);
  }
};

// Test Server Features
const testServerFeatures = async () => {
  log('=== Testing Server Features ===');
  
  try {
    // Create a test server
    const serverResponse = await axios.post(`${API_BASE_URL}/servers`, {
      name: 'Test Server',
      description: 'Server for testing real-time features'
    }, {
      headers: { Authorization: `Bearer ${tokens.user1}` }
    });

    const serverId = serverResponse.data.server.id;
    addResult('Server Creation', serverResponse.data.success, 'Test server created');

    // Test server join notifications
    let memberJoinReceived = false;
    sockets.user1.once('member-joined', (data) => {
      memberJoinReceived = true;
      addResult('Member Join Notification', true, `${data.member.username} joined the server`);
    });

    // Create invite and have user2 join
    const inviteResponse = await axios.post(`${API_BASE_URL}/servers/${serverId}/invites`, {
      maxUses: 1,
      expiresIn: 24
    }, {
      headers: { Authorization: `Bearer ${tokens.user1}` }
    });

    const inviteCode = inviteResponse.data.invite.code;

    // User2 joins via invite
    await axios.post(`${API_BASE_URL}/invites/${inviteCode}/join`, {}, {
      headers: { Authorization: `Bearer ${tokens.user2}` }
    });

    await sleep(2000);
    addResult('Server Join Test', memberJoinReceived, 'Member join notifications working');

    // Test warning system
    let warningReceived = false;
    sockets.user2.once('warning-received', (data) => {
      warningReceived = true;
      addResult('Warning Received', true, `Warning received: ${data.warning.reason}`);
    });

    const warnResponse = await axios.post(`${API_BASE_URL}/servers/${serverId}/members/${tokens.user2_data.user.id}/warn`, {
      reason: 'Test warning for real-time functionality'
    }, {
      headers: { Authorization: `Bearer ${tokens.user1}` }
    });

    await sleep(2000);
    addResult('Warning System Test', warningReceived && warnResponse.data.success, 'Warning system working');

  } catch (error) {
    addResult('Server Tests', false, `Server test failed: ${error.message}`);
  }
};

// Test Channel Messages and Typing
const testChannelFeatures = async () => {
  log('=== Testing Channel Features ===');
  
  try {
    // Find a channel (assuming test server was created)
    const serversResponse = await axios.get(`${API_BASE_URL}/servers`, {
      headers: { Authorization: `Bearer ${tokens.user1}` }
    });

    if (serversResponse.data.servers && serversResponse.data.servers.length > 0) {
      const server = serversResponse.data.servers[0];
      const channelId = server.channels[0].id;

      // Join channel
      sockets.user1.emit('join-channel', channelId);
      sockets.user2.emit('join-channel', channelId);
      await sleep(1000);

      // Test typing indicators
      let typingReceived = false;
      sockets.user2.once('user-typing', (data) => {
        typingReceived = true;
        addResult('Channel Typing', true, `${data.username} is typing in channel`);
      });

      sockets.user1.emit('typing-start', { channelId });
      await sleep(1000);
      sockets.user1.emit('typing-stop', { channelId });

      await sleep(1000);
      addResult('Channel Typing Test', typingReceived, 'Channel typing indicators working');

      // Test message sending
      let messageReceived = false;
      sockets.user2.once('new-message', (data) => {
        messageReceived = true;
        addResult('Channel Message', true, `Message received: ${data.content}`);
      });

      sockets.user1.emit('send-message', {
        content: 'Test message from socket!',
        channelId: channelId,
        serverId: server.id
      });

      await sleep(2000);
      addResult('Channel Message Test', messageReceived, 'Channel messaging working');
    }

  } catch (error) {
    addResult('Channel Tests', false, `Channel test failed: ${error.message}`);
  }
};

// Test Presence and Status
const testPresenceFeatures = async () => {
  log('=== Testing Presence Features ===');
  
  try {
    let statusUpdateReceived = false;
    sockets.user2.once('friend-status-updated', (data) => {
      statusUpdateReceived = true;
      addResult('Status Update', true, `Friend status updated: ${data.status}`);
    });

    // Update status
    sockets.user1.emit('update-status', { status: 'busy' });

    await sleep(2000);
    addResult('Presence Test', statusUpdateReceived, 'Presence updates working');

  } catch (error) {
    addResult('Presence Tests', false, `Presence test failed: ${error.message}`);
  }
};

// Main test runner
const runTests = async () => {
  log('Starting comprehensive Socket.io real-time features test...');
  
  try {
    // Step 1: Authenticate users
    log('=== Authenticating Test Users ===');
    tokens.user1_data = await authenticateUser('user1');
    tokens.user2_data = await authenticateUser('user2');

    // Step 2: Connect sockets
    log('=== Connecting Socket.io Clients ===');
    await connectSocket('user1');
    await connectSocket('user2');
    await sleep(2000); // Wait for connections to stabilize

    // Step 3: Run all tests
    await testDirectMessages();
    await sleep(3000);
    
    await testFriendRequests();
    await sleep(3000);
    
    await testServerFeatures();
    await sleep(3000);
    
    await testChannelFeatures();
    await sleep(3000);
    
    await testPresenceFeatures();
    await sleep(2000);

    // Step 4: Generate test report
    generateTestReport();

  } catch (error) {
    log(`Test execution failed: ${error.message}`, 'ERROR');
  } finally {
    // Cleanup
    Object.values(sockets).forEach(socket => socket.disconnect());
    log('Test execution completed');
  }
};

// Generate test report
const generateTestReport = () => {
  log('=== TEST REPORT ===');
  
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  
  log(`Total Tests: ${totalTests}`);
  log(`Passed: ${passedTests}`, 'PASS');
  log(`Failed: ${failedTests}`, failedTests > 0 ? 'FAIL' : 'PASS');
  log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
  
  log('\n=== DETAILED RESULTS ===');
  testResults.forEach(result => {
    log(`${result.test}: ${result.passed ? 'PASS' : 'FAIL'} - ${result.message}`, result.passed ? 'PASS' : 'FAIL');
  });

  log('\n=== FAILED TESTS ===');
  const failedTestsList = testResults.filter(r => !r.passed);
  if (failedTestsList.length === 0) {
    log('No failed tests! 🎉', 'PASS');
  } else {
    failedTestsList.forEach(result => {
      log(`${result.test}: ${result.message}`, 'FAIL');
    });
  }
};

// Run the tests
runTests().catch(error => {
  log(`Fatal error: ${error.message}`, 'ERROR');
  process.exit(1);
});
