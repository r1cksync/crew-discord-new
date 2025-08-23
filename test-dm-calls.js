// Simple DM Call Testing Script
const io = require('socket.io-client');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

let user1Token, user2Token;
let user1Socket, user2Socket;
let user1Data, user2Data;

const log = (message) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Create test users
async function setupUsers() {
  log('📋 Setting up test users...');
  
  const timestamp = Date.now();
  const users = [
    {
      username: `caller_${timestamp}`,
      email: `caller_${timestamp}@example.com`,
      password: 'password123'
    },
    {
      username: `receiver_${timestamp}`,
      email: `receiver_${timestamp}@example.com`,
      password: 'password123'
    }
  ];

  try {
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      
      // Register
      const registerResponse = await axios.post(`${API_BASE_URL}/auth/register`, user);
      
      if (registerResponse.data.success) {
        // Login
        const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
          email: user.email,
          password: user.password
        });
        
        if (loginResponse.data.success) {
          if (i === 0) {
            user1Token = loginResponse.data.token;
            user1Data = loginResponse.data.user;
            log(`✅ Created caller: ${user.username}`);
          } else {
            user2Token = loginResponse.data.token;
            user2Data = loginResponse.data.user;
            log(`✅ Created receiver: ${user.username}`);
          }
        }
      }
    }
    
  } catch (error) {
    log(`❌ User setup failed: ${error.message}`);
    throw error;
  }
}

// Connect users via Socket.io
function connectSockets() {
  log('🔌 Connecting users via Socket.io...');
  
  return Promise.all([
    new Promise((resolve, reject) => {
      user1Socket = io(SOCKET_URL, {
        auth: { token: user1Token }
      });

      user1Socket.on('connect', () => {
        log('✅ Caller connected via Socket.io');
        resolve();
      });

      user1Socket.on('connect_error', reject);
    }),
    
    new Promise((resolve, reject) => {
      user2Socket = io(SOCKET_URL, {
        auth: { token: user2Token }
      });

      user2Socket.on('connect', () => {
        log('✅ Receiver connected via Socket.io');
        resolve();
      });

      user2Socket.on('connect_error', reject);
    })
  ]);
}

// Test DM voice call flow
async function testDMCall() {
  log('📞 Testing DM Voice Call...');

  return new Promise((resolve, reject) => {
    let callReceived = false;
    let callAccepted = false;
    let sessionId = null;

    // Set up receiver listeners
    user2Socket.on('dm-call-incoming', (data) => {
      log(`📞 Incoming call received by ${user2Data.username} from ${data.caller.username}`);
      log(`   Call type: ${data.isVideoCall ? 'Video' : 'Voice'} call`);
      log(`   Session ID: ${data.sessionId}`);
      
      callReceived = true;
      sessionId = data.sessionId;
      
      // Accept the call after 1 second
      setTimeout(() => {
        log(`📞 ${user2Data.username} accepting the call...`);
        user2Socket.emit('accept-dm-call', {
          sessionId: data.sessionId,
          peerId: 'mock-peer-id-receiver'
        });
      }, 1000);
    });

    // Set up caller listeners
    user1Socket.on('dm-call-initiated', (data) => {
      log(`📞 Call initiated by ${user1Data.username}`);
      log(`   Session ID: ${data.sessionId}`);
      log(`   Recipient: ${data.recipientId}`);
    });

    user1Socket.on('dm-call-accepted', (data) => {
      log(`📞 Call accepted by ${data.accepter.username}`);
      callAccepted = true;
      
      // Test voice state updates in the call
      setTimeout(() => {
        log('🎤 Testing voice state updates in call...');
        
        // Caller mutes themselves
        user1Socket.emit('update-voice-state', {
          sessionId: sessionId,
          isMuted: true
        });
        
        // Receiver enables video
        user2Socket.emit('update-voice-state', {
          sessionId: sessionId,
          isVideoEnabled: true
        });
        
      }, 1000);
      
      // End the call after testing
      setTimeout(() => {
        log(`📞 ${user1Data.username} ending the call...`);
        user1Socket.emit('end-dm-call', {
          sessionId: sessionId
        });
      }, 3000);
    });

    user2Socket.on('dm-call-ended', (data) => {
      log(`📞 Call ended by ${data.endedBy.username}`);
      
      if (callReceived && callAccepted) {
        log('✅ DM call test completed successfully!');
        resolve();
      } else {
        reject(new Error('DM call flow incomplete'));
      }
    });

    user1Socket.on('dm-call-declined', (data) => {
      log(`📞 Call declined by ${data.decliner.username}`);
      reject(new Error('Call was declined'));
    });

    // Error handlers
    user1Socket.on('error', (error) => {
      log(`❌ Caller error: ${error.message}`);
      reject(error);
    });

    user2Socket.on('error', (error) => {
      log(`❌ Receiver error: ${error.message}`);
      reject(error);
    });

    // Initiate the call
    log(`📞 ${user1Data.username} initiating voice call to ${user2Data.username}...`);
    user1Socket.emit('initiate-dm-call', {
      recipientId: user2Data.id,
      isVideoCall: false
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      reject(new Error('DM call test timeout'));
    }, 10000);
  });
}

// Test DM video call
async function testDMVideoCall() {
  log('📹 Testing DM Video Call...');

  return new Promise((resolve, reject) => {
    let videoCallReceived = false;
    let sessionId = null;

    // Set up receiver listeners for video call
    user2Socket.on('dm-call-incoming', (data) => {
      if (data.isVideoCall) {
        log(`📹 Video call received by ${user2Data.username} from ${data.caller.username}`);
        videoCallReceived = true;
        sessionId = data.sessionId;
        
        // Decline this video call to test decline flow
        setTimeout(() => {
          log(`📹 ${user2Data.username} declining the video call...`);
          user2Socket.emit('decline-dm-call', {
            sessionId: data.sessionId
          });
        }, 1000);
      }
    });

    user1Socket.on('dm-call-declined', (data) => {
      log(`📹 Video call declined by ${data.decliner.username}`);
      
      if (videoCallReceived) {
        log('✅ DM video call decline test completed successfully!');
        resolve();
      } else {
        reject(new Error('Video call was not properly received'));
      }
    });

    // Initiate video call
    log(`📹 ${user1Data.username} initiating video call to ${user2Data.username}...`);
    user1Socket.emit('initiate-dm-call', {
      recipientId: user2Data.id,
      isVideoCall: true
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      reject(new Error('DM video call test timeout'));
    }, 5000);
  });
}

// Test WebRTC signaling simulation
async function testWebRTCSignaling() {
  log('📡 Testing WebRTC Signaling...');

  return new Promise((resolve, reject) => {
    let signalReceived = false;

    // Set up signal listener on user2
    user2Socket.on('webrtc-signal', (data) => {
      log(`📡 WebRTC signal received by ${user2Data.username}:`);
      log(`   Type: ${data.type}`);
      log(`   From: ${data.fromUsername}`);
      log(`   Signal: ${JSON.stringify(data.signal)}`);
      
      signalReceived = true;
      
      // Send answer back
      user2Socket.emit('webrtc-signal', {
        sessionId: 'test-session-123',
        targetUserId: user1Data.id,
        signal: { type: 'answer', sdp: 'mock-answer-sdp' },
        type: 'answer'
      });
    });

    // Set up answer listener on user1
    user1Socket.on('webrtc-signal', (data) => {
      if (data.type === 'answer') {
        log(`📡 WebRTC answer received by ${user1Data.username} from ${data.fromUsername}`);
        
        if (signalReceived) {
          log('✅ WebRTC signaling test completed successfully!');
          resolve();
        }
      }
    });

    // Send offer from user1 to user2
    log(`📡 ${user1Data.username} sending WebRTC offer to ${user2Data.username}...`);
    user1Socket.emit('webrtc-signal', {
      sessionId: 'test-session-123',
      targetUserId: user2Data.id,
      signal: { type: 'offer', sdp: 'mock-offer-sdp' },
      type: 'offer'
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      reject(new Error('WebRTC signaling test timeout'));
    }, 5000);
  });
}

// Cleanup
function cleanup() {
  log('🧹 Cleaning up...');
  
  if (user1Socket && user1Socket.connected) {
    user1Socket.disconnect();
  }
  
  if (user2Socket && user2Socket.connected) {
    user2Socket.disconnect();
  }
  
  log('✅ Cleanup completed');
}

// Main test runner
async function runSimpleDMCallTest() {
  log('🎬 Starting Simple DM Call Test...');
  
  try {
    await setupUsers();
    await connectSockets();
    await sleep(2000); // Let connections stabilize
    
    await testDMCall();
    await sleep(1000);
    
    await testDMVideoCall();
    await sleep(1000);
    
    await testWebRTCSignaling();
    
    log('🎉 All DM call tests completed successfully!');
    
  } catch (error) {
    log(`❌ Test failed: ${error.message}`);
    throw error;
  } finally {
    cleanup();
  }
}

// Run the test
if (require.main === module) {
  runSimpleDMCallTest()
    .then(() => {
      log('✅ Test execution completed');
      process.exit(0);
    })
    .catch((error) => {
      log(`❌ Test execution failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { runSimpleDMCallTest };
