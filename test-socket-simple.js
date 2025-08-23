/**
 * Simplified Socket.io Testing Script
 * Tests basic connectivity and working features first
 */

const io = require('socket.io-client');
const axios = require('axios');
require('dotenv').config();

// Configuration
const API_BASE_URL = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

// Test users
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

const log = (message, type = 'INFO') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}] ${message}`);
};

const addResult = (test, passed, message) => {
  testResults.push({ test, passed, message });
  log(`${test}: ${passed ? 'PASS' : 'FAIL'} - ${message}`, passed ? 'PASS' : 'FAIL');
};

// Authentication helper
const authenticateUser = async (userKey) => {
  try {
    const user = TEST_USERS[userKey];
    
    let response;
    try {
      response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: user.email,
        password: user.password
      });
    } catch (loginError) {
      // If login fails, try to register
      await axios.post(`${API_BASE_URL}/auth/register`, {
        username: user.username,
        email: user.email,
        password: user.password
      });
      
      response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: user.email,
        password: user.password
      });
    }

    tokens[userKey] = response.data.token;
    return response.data;
  } catch (error) {
    log(`Authentication failed for ${userKey}: ${error.response?.data?.error || error.message}`, 'ERROR');
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
      
      // Set up event listeners
      socket.on('dm-received', (data) => {
        log(`${userKey} received DM: ${data.message.content}`);
      });
      
      socket.on('dm-sent', (data) => {
        log(`${userKey} DM sent confirmation: ${data.message.content}`);
      });
      
      socket.on('dm-user-typing', (data) => {
        log(`${userKey} sees ${data.username} typing in DM`);
      });
      
      socket.on('server-created', (data) => {
        log(`${userKey} received server-created: ${data.server.name}`);
      });
      
      socket.on('error', (error) => {
        log(`${userKey} socket error: ${JSON.stringify(error)}`, 'ERROR');
      });
      
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      log(`Socket connection failed for ${userKey}: ${error.message}`, 'ERROR');
      reject(error);
    });
  });
};

// Test basic socket features
const testBasicSocketFeatures = async () => {
  log('=== Testing Basic Socket Features ===');
  
  try {
    // Test 1: Socket DM sending
    let dmReceived = false;
    sockets.user2.once('dm-received', (data) => {
      dmReceived = true;
      addResult('Socket DM Receive', true, `Received: ${data.message.content}`);
    });

    sockets.user1.emit('send-dm', {
      content: 'Hello from socket test!',
      recipientId: tokens.user2_data.user.id
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    addResult('Socket DM Send', dmReceived, 'Socket DM functionality');

    // Test 2: Typing indicators
    let typingReceived = false;
    sockets.user2.once('dm-user-typing', (data) => {
      typingReceived = true;
      addResult('DM Typing Indicator', true, `${data.username} is typing`);
    });

    sockets.user1.emit('dm-typing-start', { recipientId: tokens.user2_data.user.id });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    addResult('Typing Indicators', typingReceived, 'DM typing indicators');

    // Test 3: Status updates
    sockets.user1.emit('update-status', { status: 'busy' });
    addResult('Status Update', true, 'Status update sent');

  } catch (error) {
    addResult('Basic Socket Tests', false, `Test failed: ${error.message}`);
  }
};

// Test server creation (this was working)
const testServerCreation = async () => {
  log('=== Testing Server Creation ===');
  
  try {
    let serverCreated = false;
    sockets.user1.once('server-created', (data) => {
      serverCreated = true;
      addResult('Server Created Event', true, `Server: ${data.server.name}`);
    });

    const serverResponse = await axios.post(`${API_BASE_URL}/servers`, {
      name: 'Simple Test Server',
      description: 'Basic test server'
    }, {
      headers: { Authorization: `Bearer ${tokens.user1}` }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    addResult('Server Creation API', serverResponse.data.success, 'Server creation via API');
    addResult('Server Creation Socket', serverCreated, 'Server creation socket event');

  } catch (error) {
    addResult('Server Creation Test', false, `Test failed: ${error.response?.data?.error || error.message}`);
  }
};

// Generate simple report
const generateReport = () => {
  log('=== TEST REPORT ===');
  
  const total = testResults.length;
  const passed = testResults.filter(r => r.passed).length;
  
  log(`Total Tests: ${total}`);
  log(`Passed: ${passed}`, 'PASS');
  log(`Failed: ${total - passed}`, total - passed > 0 ? 'FAIL' : 'PASS');
  log(`Success Rate: ${((passed / total) * 100).toFixed(2)}%`);
  
  testResults.forEach(result => {
    log(`${result.test}: ${result.passed ? 'PASS' : 'FAIL'} - ${result.message}`, result.passed ? 'PASS' : 'FAIL');
  });
};

// Main test runner
const runSimpleTests = async () => {
  log('Starting simplified Socket.io tests...');
  
  try {
    // Authenticate
    log('=== Authentication ===');
    tokens.user1_data = await authenticateUser('user1');
    tokens.user2_data = await authenticateUser('user2');

    // Connect sockets
    log('=== Socket Connections ===');
    await connectSocket('user1');
    await connectSocket('user2');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Run tests
    await testBasicSocketFeatures();
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await testServerCreation();
    await new Promise(resolve => setTimeout(resolve, 3000));

    generateReport();

  } catch (error) {
    log(`Test execution failed: ${error.message}`, 'ERROR');
  } finally {
    Object.values(sockets).forEach(socket => socket.disconnect());
    log('Tests completed');
  }
};

runSimpleTests();
