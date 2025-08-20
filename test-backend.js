// Test script to verify backend functionality
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

// Generate unique test data to avoid conflicts
const timestamp = Date.now();
const testUser = {
  username: `testuser_${timestamp}`,
  email: `test_${timestamp}@example.com`,
  password: 'password123'
};

async function testBackend() {
  console.log('🚀 Testing Discord Clone Backend...\n');

  try {
    // Test 1: Register a new user
    console.log('1. Testing user registration...');
    const registerResponse = await axios.post(`${API_BASE}/auth/register`, testUser);
    
    console.log('✅ Registration successful');
    const token = registerResponse.data.token;

    // Test 2: Login
    console.log('2. Testing user login...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    
    console.log('✅ Login successful');

    // Test 3: Create a server
    console.log('3. Testing server creation...');
    const serverResponse = await axios.post(`${API_BASE}/servers`, {
      name: `Test Server ${timestamp}`,
      description: 'A test server for our Discord clone'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Server creation successful');
    const serverId = serverResponse.data.server._id;

    // Test 4: Get user's servers
    console.log('4. Testing get servers...');
    const serversResponse = await axios.get(`${API_BASE}/servers`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Get servers successful');
    console.log(`📊 User has ${serversResponse.data.servers.length} server(s)`);

    console.log('\n🎉 All tests passed! Backend is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testBackend();
}

module.exports = testBackend;
