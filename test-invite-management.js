const axios = require('axios');

// Test configuration
const API_BASE = 'http://localhost:3001/api';

// Test data
let testUser = null;
let testToken = null;
let testServer = null;

async function testInviteManagement() {
  console.log('🚀 Starting Invite Management Tests...\n');
  
  // First check if server is running
  try {
    console.log('🔍 Checking server connectivity...');
    const healthCheck = await axios.get(`${API_BASE.replace('/api', '')}/`);
    console.log(`   ✅ Server is responding (Status: ${healthCheck.status})\n`);
  } catch (error) {
    console.log(`   ❌ Server connectivity check failed:`);
    console.log(`   💥 Error: ${error.message}`);
    console.log(`   🔗 Trying to connect to: ${API_BASE}`);
    console.log(`   💡 Make sure the server is running with 'npm run dev'\n`);
    return;
  }
  
  const tests = [
    { name: 'Setup Test User', fn: setupTestUser },
    { name: 'Create Test Server', fn: createTestServer },
    { name: 'Get Invite Code', fn: testGetInviteCode },
    { name: 'Validate Invite Code (Public)', fn: testValidateInviteCode },
    { name: 'Get Invite Statistics', fn: testGetInviteStatistics },
    { name: 'Regenerate Invite Code', fn: testRegenerateInviteCode },
    { name: 'Test Join with New Invite', fn: testJoinWithNewInvite },
    { name: 'Test Invalid Invite Code', fn: testInvalidInviteCode },
    { name: 'Cleanup Test Data', fn: cleanupTestData }
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const test of tests) {
    try {
      console.log(`🧪 ${test.name}...`);
      await test.fn();
      console.log(`✅ ${test.name} - PASSED\n`);
      passedTests++;
    } catch (error) {
      console.log(`❌ ${test.name} - FAILED: ${error.message}\n`);
      failedTests++;
      
      // If critical tests fail, stop
      if (['Setup Test User', 'Create Test Server'].includes(test.name)) {
        break;
      }
    }
  }

  console.log('📊 Invite Management Test Results:');
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log(`   📈 Success Rate: ${((passedTests / tests.length) * 100).toFixed(1)}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 All invite management tests passed! Invite system is working perfectly!');
  } else {
    console.log('\n⚠️  Some invite management tests failed. Check the implementation.');
  }
}

async function setupTestUser() {
  const timestamp = Date.now();
  const userData = {
    username: `invitetest_${timestamp}`,
    email: `invitetest_${timestamp}@example.com`,
    password: 'testpassword123'
  };

  const response = await axios.post(`${API_BASE}/auth/register`, userData);
  
  if (!response.data.success) {
    throw new Error(`Registration failed: ${response.data.error}`);
  }

  testUser = response.data.user;
  testToken = response.data.token;
  
  console.log(`   ✅ Test user created: ${testUser.username}`);
  console.log(`   🔑 Token received: ${testToken ? 'Yes' : 'No'}`);
}

async function createTestServer() {
  const serverData = {
    name: `Invite Test Server ${Date.now()}`,
    description: 'A server for testing invite management'
  };

  const response = await axios.post(`${API_BASE}/servers`, serverData, {
    headers: {
      'Authorization': `Bearer ${testToken}`
    }
  });

  if (!response.data.success) {
    throw new Error(`Server creation failed: ${response.data.error}`);
  }

  testServer = response.data.server;
  
  console.log(`   ✅ Test server created: ${testServer.name}`);
  console.log(`   🔗 Auto-generated invite code: ${testServer.inviteCode}`);
}

async function testGetInviteCode() {
  const response = await axios.get(`${API_BASE}/servers/${testServer._id}/invite`, {
    headers: {
      'Authorization': `Bearer ${testToken}`
    }
  });

  if (!response.data.success) {
    throw new Error('Failed to get invite code');
  }

  const inviteData = response.data;
  if (!inviteData.inviteCode || !inviteData.inviteUrl) {
    throw new Error('Missing invite code or URL in response');
  }

  console.log(`   ✅ Retrieved invite code: ${inviteData.inviteCode}`);
  console.log(`   🔗 Invite URL: ${inviteData.inviteUrl}`);
  console.log(`   👥 Member count: ${inviteData.memberCount}`);
}

async function testValidateInviteCode() {
  const response = await axios.get(`${API_BASE}/invite/${testServer.inviteCode}`);

  if (!response.data.success || !response.data.valid) {
    throw new Error('Invite code validation failed');
  }

  const serverInfo = response.data.server;
  if (serverInfo.name !== testServer.name) {
    throw new Error('Server name mismatch in validation');
  }

  console.log(`   ✅ Invite code validated successfully`);
  console.log(`   🏠 Server: ${serverInfo.name}`);
  console.log(`   👥 Members: ${serverInfo.memberCount}`);
  console.log(`   👑 Owner: ${serverInfo.owner.username}`);
}

async function testGetInviteStatistics() {
  const response = await axios.get(`${API_BASE}/servers/${testServer._id}/invites`, {
    headers: {
      'Authorization': `Bearer ${testToken}`
    }
  });

  if (!response.data.success) {
    throw new Error('Failed to get invite statistics');
  }

  const stats = response.data;
  if (!stats.inviteInfo || !stats.statistics || !stats.permissions) {
    throw new Error('Missing required fields in invite statistics');
  }

  console.log(`   ✅ Invite statistics retrieved`);
  console.log(`   📊 Total members: ${stats.statistics.totalMembers}`);
  console.log(`   📈 Recent joins (7 days): ${stats.statistics.recentJoins}`);
  console.log(`   👑 Can regenerate invite: ${stats.permissions.canRegenerateInvite}`);
  console.log(`   📋 Recent members: ${stats.recentMembers.length}`);
}

async function testRegenerateInviteCode() {
  const oldInviteCode = testServer.inviteCode;
  
  const response = await axios.post(`${API_BASE}/servers/${testServer._id}/invite/regenerate`, {}, {
    headers: {
      'Authorization': `Bearer ${testToken}`
    }
  });

  if (!response.data.success) {
    throw new Error('Failed to regenerate invite code');
  }

  const newInviteData = response.data;
  if (!newInviteData.newInviteCode || newInviteData.newInviteCode === oldInviteCode) {
    throw new Error('New invite code not generated or same as old code');
  }

  // Update our test server data
  testServer.inviteCode = newInviteData.newInviteCode;

  console.log(`   ✅ Invite code regenerated successfully`);
  console.log(`   🔄 Old code: ${newInviteData.oldInviteCode}`);
  console.log(`   🆕 New code: ${newInviteData.newInviteCode}`);
  console.log(`   🔗 New URL: ${newInviteData.inviteUrl}`);
}

async function testJoinWithNewInvite() {
  // Create a second user to test joining
  const timestamp = Date.now();
  const userData = {
    username: `jointest_${timestamp}`,
    email: `jointest_${timestamp}@example.com`,
    password: 'testpassword123'
  };

  const regResponse = await axios.post(`${API_BASE}/auth/register`, userData);
  if (!regResponse.data.success) {
    throw new Error('Failed to create second test user');
  }

  const secondUserToken = regResponse.data.token;

  // Try to join with the new invite code
  const joinResponse = await axios.post(`${API_BASE}/servers/join/${testServer.inviteCode}`, {}, {
    headers: {
      'Authorization': `Bearer ${secondUserToken}`
    }
  });

  if (!joinResponse.data.success) {
    throw new Error('Failed to join server with new invite code');
  }

  console.log(`   ✅ Second user joined successfully with new invite`);
  console.log(`   👤 User: ${regResponse.data.user.username}`);
  console.log(`   🏠 Joined server: ${joinResponse.data.server.name}`);
  console.log(`   👥 New member count: ${joinResponse.data.server.memberCount}`);
}

async function testInvalidInviteCode() {
  const invalidCode = 'invalidcode123456789';
  
  try {
    const response = await axios.get(`${API_BASE}/invite/${invalidCode}`);
    
    // If we get here, the request didn't fail as expected
    if (response.data.success) {
      throw new Error('Invalid invite code should have failed');
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(`   ✅ Invalid invite code properly rejected (404)`);
    } else {
      throw new Error(`Unexpected error for invalid invite: ${error.message}`);
    }
  }
}

async function cleanupTestData() {
  try {
    // Delete the test server
    if (testServer && testToken) {
      await axios.delete(`${API_BASE}/servers/${testServer._id}`, {
        headers: {
          'Authorization': `Bearer ${testToken}`
        }
      });
      console.log(`   ✅ Test server deleted`);
    }

    console.log(`   ✅ Test data cleanup completed`);
  } catch (error) {
    console.log(`   ⚠️  Cleanup warning: ${error.message}`);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testInviteManagement().catch(console.error);
}

module.exports = testInviteManagement;
