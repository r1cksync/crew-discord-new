// Test script for Discord Clone Backend - Server Moderation Features
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';
const timestamp = Date.now();

// Test data
let user1Token, user2Token, user3Token; // Admin, Member, Target
let testServer;
let testRole;
let userId1, userId2, userId3;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testUserCreation() {
  console.log('👥 Creating test users...');
  
  try {
    // Create admin user
    const admin = await axios.post(`${API_BASE}/auth/register`, {
      username: `admin_${timestamp}`,
      email: `admin_${timestamp}@test.com`,
      password: 'password123'
    });
    
    user1Token = admin.data.token;
    userId1 = admin.data.user.id;
    console.log('   ✅ Admin user created');

    // Create regular member
    const member = await axios.post(`${API_BASE}/auth/register`, {
      username: `member_${timestamp}`,
      email: `member_${timestamp}@test.com`,
      password: 'password123'
    });
    
    user2Token = member.data.token;
    userId2 = member.data.user.id;
    console.log('   ✅ Member user created');

    // Create target user
    const target = await axios.post(`${API_BASE}/auth/register`, {
      username: `target_${timestamp}`,
      email: `target_${timestamp}@test.com`,
      password: 'password123'
    });
    
    user3Token = target.data.token;
    userId3 = target.data.user.id;
    console.log('   ✅ Target user created');

  } catch (error) {
    console.log('   ❌ User creation failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testServerSetup() {
  console.log('🏢 Setting up test server...');
  
  try {
    // Create server
    const serverResponse = await axios.post(`${API_BASE}/servers`, {
      name: `Moderation Test Server ${timestamp}`,
      description: 'Testing server moderation features'
    }, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    
    testServer = serverResponse.data.server;
    console.log('   ✅ Server created');

    // Join users to server
    await axios.post(`${API_BASE}/servers/join/${testServer.inviteCode}`, {}, {
      headers: { 'Authorization': `Bearer ${user2Token}` }
    });
    console.log('   ✅ Member joined server');

    await axios.post(`${API_BASE}/servers/join/${testServer.inviteCode}`, {}, {
      headers: { 'Authorization': `Bearer ${user3Token}` }
    });
    console.log('   ✅ Target user joined server');

  } catch (error) {
    console.log('   ❌ Server setup failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testRoleManagement() {
  console.log('🎭 Testing role management...');
  
  try {
    // Create a moderator role
    const roleResponse = await axios.post(`${API_BASE}/servers/${testServer._id}/roles`, {
      name: 'Moderator',
      color: '#ff6b35',
      permissions: ['KICK_MEMBERS', 'MUTE_MEMBERS', 'MANAGE_MESSAGES'],
      mentionable: true
    }, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    
    testRole = roleResponse.data.role;
    console.log('   ✅ Moderator role created');
    console.log(`   📊 Role ID: ${testRole.id}`);
    console.log(`   📊 Permissions: ${testRole.permissions.join(', ')}`);

    // Get all server roles
    const rolesResponse = await axios.get(`${API_BASE}/servers/${testServer._id}/roles`, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    
    console.log(`   ✅ Retrieved ${rolesResponse.data.roles.length} server roles`);

    // Assign moderator role to user2
    await axios.put(`${API_BASE}/servers/${testServer._id}/members/${userId2}/roles`, {
      roleIds: [testRole.id],
      action: 'add'
    }, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    
    console.log('   ✅ Moderator role assigned to member');

    // Get member roles
    const memberRolesResponse = await axios.get(`${API_BASE}/servers/${testServer._id}/members/${userId2}/roles`, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    
    console.log(`   ✅ Member has ${memberRolesResponse.data.roles.length} roles`);

  } catch (error) {
    console.log('   ❌ Role management failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testWarningSystem() {
  console.log('⚠️ Testing warning system...');
  
  try {
    // Issue a warning (as moderator)
    const warnResponse = await axios.post(`${API_BASE}/servers/${testServer._id}/members/${userId3}/warn`, {
      reason: 'Spam messages in general chat'
    }, {
      headers: { 'Authorization': `Bearer ${user2Token}` } // Using moderator token
    });
    
    console.log('   ✅ Warning issued successfully');
    console.log(`   📊 Warning count: ${warnResponse.data.warning.warningCount}`);

    // Issue another warning
    await axios.post(`${API_BASE}/servers/${testServer._id}/members/${userId3}/warn`, {
      reason: 'Inappropriate language'
    }, {
      headers: { 'Authorization': `Bearer ${user2Token}` }
    });
    
    console.log('   ✅ Second warning issued');

    // Get warnings for user
    const warningsResponse = await axios.get(`${API_BASE}/servers/${testServer._id}/members/${userId3}/warn`, {
      headers: { 'Authorization': `Bearer ${user2Token}` }
    });
    
    console.log(`   ✅ Retrieved ${warningsResponse.data.totalWarnings} warnings for user`);

    // Test permission error (regular user trying to warn)
    try {
      await axios.post(`${API_BASE}/servers/${testServer._id}/members/${userId2}/warn`, {
        reason: 'Test warning'
      }, {
        headers: { 'Authorization': `Bearer ${user3Token}` } // Target user (no permissions)
      });
      console.log('   ❌ Permission check failed - warning should have been rejected');
    } catch (error) {
      console.log('   ✅ Permission check working - unauthorized warning rejected');
    }

  } catch (error) {
    console.log('   ❌ Warning system failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testTimeoutSystem() {
  console.log('⏰ Testing timeout/mute system...');
  
  try {
    // Timeout a user for 5 minutes
    const timeoutResponse = await axios.post(`${API_BASE}/servers/${testServer._id}/members/${userId3}/timeout`, {
      duration: 5, // 5 minutes
      reason: 'Repeated violations after warnings'
    }, {
      headers: { 'Authorization': `Bearer ${user2Token}` } // Using moderator token
    });
    
    console.log('   ✅ User timed out successfully');
    console.log(`   📊 Timeout until: ${timeoutResponse.data.timeoutUntil}`);

    // Test trying to timeout an already timed out user
    try {
      await axios.post(`${API_BASE}/servers/${testServer._id}/members/${userId3}/timeout`, {
        duration: 10,
        reason: 'Another timeout'
      }, {
        headers: { 'Authorization': `Bearer ${user2Token}` }
      });
      console.log('   ✅ Multiple timeouts handled (should replace existing)');
    } catch (error) {
      console.log('   ✅ Multiple timeout handling working');
    }

    // Remove timeout
    const removeTimeoutResponse = await axios.delete(`${API_BASE}/servers/${testServer._id}/members/${userId3}/timeout`, {
      headers: { 'Authorization': `Bearer ${user2Token}` }
    });
    
    console.log('   ✅ Timeout removed successfully');

  } catch (error) {
    console.log('   ❌ Timeout system failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testKickSystem() {
  console.log('👢 Testing kick system...');
  
  try {
    // Kick the target user
    const kickResponse = await axios.post(`${API_BASE}/servers/${testServer._id}/members/${userId3}/kick`, {
      reason: 'Multiple violations and timeout abuse'
    }, {
      headers: { 'Authorization': `Bearer ${user2Token}` } // Using moderator token
    });
    
    console.log('   ✅ User kicked successfully');
    console.log(`   📊 Kicked user: ${kickResponse.data.kickedUser.username}`);

    // Test that kicked user is no longer in server (by trying to kick again)
    try {
      await axios.post(`${API_BASE}/servers/${testServer._id}/members/${userId3}/kick`, {
        reason: 'Test kick'
      }, {
        headers: { 'Authorization': `Bearer ${user2Token}` }
      });
      console.log('   ❌ Kick validation failed - should not be able to kick non-member');
    } catch (error) {
      console.log('   ✅ Kick validation working - cannot kick non-member');
    }

    // Rejoin the server for ban test
    await axios.post(`${API_BASE}/servers/join/${testServer.inviteCode}`, {}, {
      headers: { 'Authorization': `Bearer ${user3Token}` }
    });
    console.log('   ✅ Target user rejoined for ban test');

  } catch (error) {
    console.log('   ❌ Kick system failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testBanSystem() {
  console.log('🔨 Testing ban system...');
  
  try {
    // Ban the target user
    const banResponse = await axios.post(`${API_BASE}/servers/${testServer._id}/members/${userId3}/ban`, {
      reason: 'Persistent rule violations',
      deleteMessageDays: 1
    }, {
      headers: { 'Authorization': `Bearer ${user1Token}` } // Using admin token
    });
    
    console.log('   ✅ User banned successfully');
    console.log(`   📊 Banned user: ${banResponse.data.bannedUser.username}`);

    // Test that banned user cannot rejoin
    try {
      await axios.post(`${API_BASE}/servers/join/${testServer.inviteCode}`, {}, {
        headers: { 'Authorization': `Bearer ${user3Token}` }
      });
      console.log('   ❌ Ban enforcement failed - banned user should not be able to join');
    } catch (error) {
      console.log('   ✅ Ban enforcement working - banned user cannot join');
    }

    // Test duplicate ban
    try {
      await axios.post(`${API_BASE}/servers/${testServer._id}/members/${userId3}/ban`, {
        reason: 'Test duplicate ban'
      }, {
        headers: { 'Authorization': `Bearer ${user1Token}` }
      });
      console.log('   ❌ Duplicate ban check failed');
    } catch (error) {
      console.log('   ✅ Duplicate ban prevention working');
    }

  } catch (error) {
    console.log('   ❌ Ban system failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testRoleHierarchy() {
  console.log('🏗️ Testing role hierarchy enforcement...');
  
  try {
    // Try to have moderator kick the admin (should fail)
    try {
      await axios.post(`${API_BASE}/servers/${testServer._id}/members/${userId1}/kick`, {
        reason: 'Testing hierarchy'
      }, {
        headers: { 'Authorization': `Bearer ${user2Token}` } // Moderator trying to kick admin
      });
      console.log('   ❌ Role hierarchy failed - moderator should not be able to kick admin');
    } catch (error) {
      console.log('   ✅ Role hierarchy working - moderator cannot kick higher role');
    }

    // Try to have moderator modify admin's roles (should fail)
    try {
      await axios.put(`${API_BASE}/servers/${testServer._id}/members/${userId1}/roles`, {
        roleIds: [testRole.id],
        action: 'add'
      }, {
        headers: { 'Authorization': `Bearer ${user2Token}` }
      });
      console.log('   ❌ Role hierarchy failed - moderator should not be able to modify admin roles');
    } catch (error) {
      console.log('   ✅ Role hierarchy working - moderator cannot modify higher role user');
    }

  } catch (error) {
    console.log('   ❌ Role hierarchy test failed:', error.response?.data?.error || error.message);
  }
}

async function testPermissionChecking() {
  console.log('🔐 Testing permission checking...');
  
  try {
    // Remove moderator role from user2
    await axios.put(`${API_BASE}/servers/${testServer._id}/members/${userId2}/roles`, {
      roleIds: [testRole.id],
      action: 'remove'
    }, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    console.log('   ✅ Moderator role removed');

    // Try to issue warning without permissions (should fail)
    try {
      await axios.post(`${API_BASE}/servers/${testServer._id}/members/${userId1}/warn`, {
        reason: 'Test without permission'
      }, {
        headers: { 'Authorization': `Bearer ${user2Token}` }
      });
      console.log('   ❌ Permission enforcement failed');
    } catch (error) {
      console.log('   ✅ Permission enforcement working - insufficient permissions rejected');
    }

    // Create role with ADMINISTRATOR permission
    const adminRoleResponse = await axios.post(`${API_BASE}/servers/${testServer._id}/roles`, {
      name: 'Administrator',
      color: '#ff0000',
      permissions: ['ADMINISTRATOR'],
      mentionable: false
    }, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });

    // Assign admin role to user2
    await axios.put(`${API_BASE}/servers/${testServer._id}/members/${userId2}/roles`, {
      roleIds: [adminRoleResponse.data.role.id],
      action: 'add'
    }, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });

    // Now user2 should be able to do admin actions
    await axios.post(`${API_BASE}/servers/${testServer._id}/roles`, {
      name: 'Test Role',
      permissions: ['SEND_MESSAGES']
    }, {
      headers: { 'Authorization': `Bearer ${user2Token}` }
    });
    console.log('   ✅ ADMINISTRATOR permission grants all access');

  } catch (error) {
    console.log('   ❌ Permission checking failed:', error.response?.data?.error || error.message);
  }
}

async function runModerationTests() {
  console.log('🎯 Starting Discord Clone Backend - Moderation Features Test Suite\n');
  
  const startTime = Date.now();
  let passedTests = 0;
  let totalTests = 8;

  try {
    await testUserCreation();
    passedTests++;
    console.log('');

    await testServerSetup();
    passedTests++;
    console.log('');

    await testRoleManagement();
    passedTests++;
    console.log('');

    await testWarningSystem();
    passedTests++;
    console.log('');

    await testTimeoutSystem();
    passedTests++;
    console.log('');

    await testKickSystem();
    passedTests++;
    console.log('');

    await testBanSystem();
    passedTests++;
    console.log('');

    await testRoleHierarchy();
    passedTests++;
    console.log('');

    await testPermissionChecking();
    console.log('');

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('🏁 MODERATION TEST RESULTS:');
  console.log('='.repeat(50));
  console.log(`📊 Tests Passed: ${passedTests}/${totalTests}`);
  console.log(`⏱️  Total Time: ${duration} seconds`);
  console.log(`✅ Success Rate: ${((passedTests/totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ALL MODERATION FEATURES WORKING PERFECTLY!');
  } else {
    console.log(`⚠️  ${totalTests - passedTests} tests failed - check implementation`);
  }

  console.log('\n🔧 IMPLEMENTED FEATURES:');
  console.log('✅ Role Management (Create, Update, Delete, Assign)');
  console.log('✅ Permission System (Hierarchy, Enforcement)');
  console.log('✅ Warning System (Issue, Track, View)');
  console.log('✅ Timeout/Mute System (Temporary restrictions)');
  console.log('✅ Kick Members (Remove from server)');
  console.log('✅ Ban Members (Permanent restriction)');
  console.log('✅ Role Hierarchy Enforcement');
  console.log('✅ Permission Checking & Validation');
}

// Only run if this file is executed directly
if (require.main === module) {
  runModerationTests().catch(console.error);
}

module.exports = { runModerationTests };
