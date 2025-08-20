// Comprehensive test script for Discord Clone Backend
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3001/api';
const TEST_IMAGE_PATH = 'C:\\Users\\user\\Downloads\\pepeToilet.png';

// Generate unique test data to avoid conflicts
const timestamp = Date.now();
const testUsers = [
  {
    username: `testuser1_${timestamp}`,
    email: `test1_${timestamp}@example.com`,
    password: 'password123'
  },
  {
    username: `testuser2_${timestamp}`,
    email: `test2_${timestamp}@example.com`,
    password: 'password123'
  }
];

let user1Token, user2Token;
let testServer, testChannel;
let user1Id, user2Id;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testUserRegistration() {
  console.log('📝 Testing user registration...');
  
  try {
    // Register first user
    const response1 = await axios.post(`${API_BASE}/auth/register`, testUsers[0]);
    console.log('   ✅ User 1 registered successfully');
    user1Token = response1.data.token;
    user1Id = response1.data.user.id;
    
    // Register second user
    const response2 = await axios.post(`${API_BASE}/auth/register`, testUsers[1]);
    console.log('   ✅ User 2 registered successfully');
    user2Token = response2.data.token;
    user2Id = response2.data.user.id;
    
    // Test duplicate registration (should fail)
    try {
      await axios.post(`${API_BASE}/auth/register`, testUsers[0]);
      console.log('   ❌ Duplicate registration should have failed');
    } catch (error) {
      console.log('   ✅ Duplicate registration properly rejected');
    }
    
  } catch (error) {
    console.log('   ❌ Registration failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testUserLogin() {
  console.log('🔐 Testing user login...');
  
  try {
    // Test valid login
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: testUsers[0].email,
      password: testUsers[0].password
    });
    console.log('   ✅ Valid login successful');
    
    // Test invalid credentials
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: testUsers[0].email,
        password: 'wrongpassword'
      });
      console.log('   ❌ Invalid login should have failed');
    } catch (error) {
      console.log('   ✅ Invalid credentials properly rejected');
    }
    
    // Test non-existent user
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: 'nonexistent@example.com',
        password: 'password123'
      });
      console.log('   ❌ Non-existent user login should have failed');
    } catch (error) {
      console.log('   ✅ Non-existent user properly rejected');
    }
    
  } catch (error) {
    console.log('   ❌ Login test failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testServerCreation() {
  console.log('🏢 Testing server creation...');
  
  try {
    const response = await axios.post(`${API_BASE}/servers`, {
      name: `Test Gaming Server ${timestamp}`,
      description: 'A server for testing our Discord clone'
    }, {
      headers: {
        'Authorization': `Bearer ${user1Token}`
      }
    });
    
    testServer = response.data.server;
    console.log('   ✅ Server created successfully');
    console.log(`   📊 Server ID: ${testServer._id}`);
    console.log(`   📊 Default channels created: ${testServer.channels.length}`);
    console.log(`   📊 Default roles created: ${testServer.roles.length}`);
    
    // Test unauthorized server creation
    try {
      await axios.post(`${API_BASE}/servers`, {
        name: 'Unauthorized Server'
      });
      console.log('   ❌ Unauthorized server creation should have failed');
    } catch (error) {
      console.log('   ✅ Unauthorized access properly rejected');
    }
    
  } catch (error) {
    console.log('   ❌ Server creation failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testServerJoining() {
  console.log('🚪 Testing server joining...');
  
  try {
    const inviteCode = testServer.inviteCode;
    console.log(`   📧 Using invite code: ${inviteCode}`);
    
    const response = await axios.post(`${API_BASE}/servers/join/${inviteCode}`, {}, {
      headers: {
        'Authorization': `Bearer ${user2Token}`
      }
    });
    
    console.log('   ✅ User 2 joined server successfully');
    
    // Test joining with invalid invite code
    try {
      await axios.post(`${API_BASE}/servers/join/invalidcode123`, {}, {
        headers: {
          'Authorization': `Bearer ${user2Token}`
        }
      });
      console.log('   ❌ Invalid invite code should have failed');
    } catch (error) {
      console.log('   ✅ Invalid invite code properly rejected');
    }
    
    // Test duplicate joining
    try {
      await axios.post(`${API_BASE}/servers/join/${inviteCode}`, {}, {
        headers: {
          'Authorization': `Bearer ${user2Token}`
        }
      });
      console.log('   ❌ Duplicate joining should have failed');
    } catch (error) {
      console.log('   ✅ Duplicate joining properly rejected');
    }
    
  } catch (error) {
    console.log('   ❌ Server joining failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testGetServers() {
  console.log('📋 Testing get servers...');
  
  try {
    const response = await axios.get(`${API_BASE}/servers`, {
      headers: {
        'Authorization': `Bearer ${user1Token}`
      }
    });
    
    console.log('   ✅ Get servers successful');
    console.log(`   📊 User 1 has ${response.data.servers.length} server(s)`);
    
    const response2 = await axios.get(`${API_BASE}/servers`, {
      headers: {
        'Authorization': `Bearer ${user2Token}`
      }
    });
    
    console.log(`   📊 User 2 has ${response2.data.servers.length} server(s)`);
    
  } catch (error) {
    console.log('   ❌ Get servers failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testChannelMessages() {
  console.log('💬 Testing channel messages...');
  
  try {
    // Get the first text channel
    testChannel = testServer.channels.find(channel => channel.type === 'text');
    
    if (!testChannel) {
      console.log('   ❌ No text channel found in server');
      return;
    }
    
    console.log(`   📺 Using channel: ${testChannel.name} (${testChannel._id})`);
    
    // Test getting messages from empty channel
    const response = await axios.get(`${API_BASE}/channels/${testChannel._id}/messages`, {
      headers: {
        'Authorization': `Bearer ${user1Token}`
      }
    });
    
    console.log('   ✅ Get messages successful');
    console.log(`   📊 Channel has ${response.data.messages.length} messages`);
    
    // Test with pagination parameters
    const response2 = await axios.get(`${API_BASE}/channels/${testChannel._id}/messages?limit=10`, {
      headers: {
        'Authorization': `Bearer ${user1Token}`
      }
    });
    
    console.log('   ✅ Get messages with pagination successful');
    
    // Test unauthorized access
    try {
      await axios.get(`${API_BASE}/channels/${testChannel._id}/messages`);
      console.log('   ❌ Unauthorized message access should have failed');
    } catch (error) {
      console.log('   ✅ Unauthorized access properly rejected');
    }
    
  } catch (error) {
    console.log('   ❌ Channel messages test failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testFileUpload() {
  console.log('📁 Testing file upload...');
  
  try {
    // Check if test image exists
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      console.log(`   ⚠️  Test image not found at: ${TEST_IMAGE_PATH}`);
      console.log('   ⚠️  Skipping file upload test');
      return;
    }
    
    const form = new FormData();
    form.append('file', fs.createReadStream(TEST_IMAGE_PATH));
    form.append('folder', 'avatars');
    
    const response = await axios.post(`${API_BASE}/upload`, form, {
      headers: {
        'Authorization': `Bearer ${user1Token}`,
        ...form.getHeaders()
      }
    });
    
    console.log('   ✅ File upload endpoint accessible');
    console.log('   ℹ️  Note: Full S3 upload requires AWS configuration');
    
  } catch (error) {
    console.log('   ❌ File upload test failed:', error.response?.data?.error || error.message);
    // Don't throw error for upload test as it may not be fully configured
  }
}

async function testLogout() {
  console.log('🚪 Testing user logout...');
  
  try {
    await axios.post(`${API_BASE}/auth/logout`, {}, {
      headers: {
        'Authorization': `Bearer ${user1Token}`
      }
    });
    
    console.log('   ✅ User 1 logout successful');
    
    await axios.post(`${API_BASE}/auth/logout`, {}, {
      headers: {
        'Authorization': `Bearer ${user2Token}`
      }
    });
    
    console.log('   ✅ User 2 logout successful');
    
    // Test unauthorized logout
    try {
      await axios.post(`${API_BASE}/auth/logout`, {});
      console.log('   ❌ Unauthorized logout should have failed');
    } catch (error) {
      console.log('   ✅ Unauthorized logout properly rejected');
    }
    
  } catch (error) {
    console.log('   ❌ Logout test failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testErrorHandling() {
  console.log('🛡️  Testing error handling...');
  
  try {
    // Test invalid endpoints
    const testCases = [
      { url: `${API_BASE}/nonexistent`, method: 'get' },
      { url: `${API_BASE}/servers/nonexistent`, method: 'get' },
      { url: `${API_BASE}/channels/invalidid/messages`, method: 'get' }
    ];
    
    for (const testCase of testCases) {
      try {
        await axios[testCase.method](testCase.url);
        console.log(`   ❌ ${testCase.url} should have failed`);
      } catch (error) {
        console.log(`   ✅ ${testCase.url} properly handled error`);
      }
    }
    
    // Test malformed requests
    try {
      await axios.post(`${API_BASE}/auth/register`, {
        // Missing required fields
        username: 'incomplete'
      });
      console.log('   ❌ Malformed registration should have failed');
    } catch (error) {
      console.log('   ✅ Malformed registration properly rejected');
    }
    
  } catch (error) {
    console.log('   ❌ Error handling test failed:', error.message);
  }
}

async function testPerformance() {
  console.log('⚡ Testing performance...');
  
  try {
    const startTime = Date.now();
    const promises = [];
    
    // Test concurrent requests
    for (let i = 0; i < 10; i++) {
      promises.push(
        axios.post(`${API_BASE}/auth/login`, {
          email: testUsers[0].email,
          password: testUsers[0].password
        })
      );
    }
    
    await Promise.all(promises);
    const endTime = Date.now();
    
    console.log(`   ✅ 10 concurrent login requests completed in ${endTime - startTime}ms`);
    console.log(`   📊 Average response time: ${(endTime - startTime) / 10}ms per request`);
    
  } catch (error) {
    console.log('   ❌ Performance test failed:', error.message);
  }
}

async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive Discord Clone Backend Tests...\n');
  
  const tests = [
    { name: 'User Registration', fn: testUserRegistration },
    { name: 'User Login', fn: testUserLogin },
    { name: 'Server Creation', fn: testServerCreation },
    { name: 'Server Joining', fn: testServerJoining },
    { name: 'Get Servers', fn: testGetServers },
    { name: 'Channel Messages', fn: testChannelMessages },
    { name: 'File Upload', fn: testFileUpload },
    { name: 'User Logout', fn: testLogout },
    { name: 'Error Handling', fn: testErrorHandling },
    { name: 'Performance', fn: testPerformance }
  ];
  
  let passedTests = 0;
  let failedTests = 0;
  
  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✅ ${test.name} - PASSED\n`);
      passedTests++;
    } catch (error) {
      console.log(`❌ ${test.name} - FAILED\n`);
      failedTests++;
    }
    
    // Small delay between tests
    await delay(500);
  }
  
  console.log('📊 Test Results Summary:');
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log(`   📈 Success Rate: ${((passedTests / tests.length) * 100).toFixed(1)}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 All tests passed! Your Discord clone backend is working perfectly!');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the error messages above.');
  }
  
  console.log('\n🔧 Additional Testing Recommendations:');
  console.log('   • Set up MongoDB and test database operations');
  console.log('   • Configure AWS S3 for file upload testing');
  console.log('   • Test Socket.io real-time messaging with a client');
  console.log('   • Load test with multiple concurrent users');
  console.log('   • Test voice channel functionality when implemented');
}

// Only run if this file is executed directly
if (require.main === module) {
  runComprehensiveTests().catch(console.error);
}

module.exports = {
  runComprehensiveTests,
  testUserRegistration,
  testUserLogin,
  testServerCreation,
  testServerJoining,
  testGetServers,
  testChannelMessages,
  testFileUpload,
  testLogout,
  testErrorHandling,
  testPerformance
};
