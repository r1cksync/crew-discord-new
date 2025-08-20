const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

let user1, user2, user3;
let user1Token, user2Token, user3Token;

async function runFriendSystemTests() {
  console.log('🤝 Starting Friend System Tests...\n');
  
  try {
    await setupTestUsers();
    await testSendFriendRequest();
    await testGetFriendRequests();
    await testAcceptFriendRequest();
    await testGetFriendsList();
    await testBlockUser();
    await testGetBlockedUsers();
    await testUnblockUser();
    await testDeclineFriendRequest();
    await testRemoveFriend();
    await testDuplicateRequests();
    await testBlockedUserInteractions();
    
    console.log('\n✅ All friend system tests passed!');
    console.log('🏆 Friend System: 100% Success Rate');
    
  } catch (error) {
    console.error('\n❌ Friend system tests failed:', error.message);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

async function setupTestUsers() {
  console.log('👥 Setting up test users...');
  
  // Create test users
  const timestamp = Date.now();
  
  const userData1 = {
    username: `friendtest1_${timestamp}`,
    email: `friendtest1_${timestamp}@example.com`,
    password: 'testpassword123'
  };
  
  const userData2 = {
    username: `friendtest2_${timestamp}`,
    email: `friendtest2_${timestamp}@example.com`,
    password: 'testpassword123'
  };
  
  const userData3 = {
    username: `friendtest3_${timestamp}`,
    email: `friendtest3_${timestamp}@example.com`,
    password: 'testpassword123'
  };

  const response1 = await axios.post(`${API_BASE}/auth/register`, userData1);
  const response2 = await axios.post(`${API_BASE}/auth/register`, userData2);
  const response3 = await axios.post(`${API_BASE}/auth/register`, userData3);

  user1 = response1.data.user;
  user1Token = response1.data.token;
  user2 = response2.data.user;
  user2Token = response2.data.token;
  user3 = response3.data.user;
  user3Token = response3.data.token;

  console.log(`   ✅ User 1: ${user1.username}`);
  console.log(`   ✅ User 2: ${user2.username}`);
  console.log(`   ✅ User 3: ${user3.username}`);
}

async function testSendFriendRequest() {
  console.log('\n📤 Testing friend request sending...');
  
  try {
    // User 1 sends friend request to User 2
    const response = await axios.post(`${API_BASE}/users/${user2.id}/friend-request`, {}, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    
    if (!response.data.success) {
      throw new Error('Failed to send friend request');
    }
    
    console.log('   ✅ Friend request sent successfully');
    console.log(`   📧 From: ${user1.username} → To: ${user2.username}`);
    
    // Test sending request to yourself (should fail)
    try {
      await axios.post(`${API_BASE}/users/${user1.id}/friend-request`, {}, {
        headers: { 'Authorization': `Bearer ${user1Token}` }
      });
      throw new Error('Should not be able to send friend request to yourself');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('   ✅ Self-friend request properly rejected');
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.log('   ❌ Friend request test failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testGetFriendRequests() {
  console.log('\n📬 Testing get friend requests...');
  
  try {
    // User 2 gets their friend requests
    const response = await axios.get(`${API_BASE}/users/me/friend-requests`, {
      headers: { 'Authorization': `Bearer ${user2Token}` }
    });
    
    if (!response.data.success || response.data.friendRequests.length === 0) {
      throw new Error('No friend requests found');
    }
    
    const request = response.data.friendRequests[0];
    if (request.from.username !== user1.username) {
      throw new Error('Friend request from wrong user');
    }
    
    console.log('   ✅ Friend requests retrieved successfully');
    console.log(`   📨 Request from: ${request.from.username}`);
    console.log(`   📅 Status: ${request.status}`);

  } catch (error) {
    console.log('   ❌ Get friend requests failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testAcceptFriendRequest() {
  console.log('\n✅ Testing accept friend request...');
  
  try {
    // Get the friend request ID
    const requestsResponse = await axios.get(`${API_BASE}/users/me/friend-requests`, {
      headers: { 'Authorization': `Bearer ${user2Token}` }
    });
    
    const requestId = requestsResponse.data.friendRequests[0].id;
    
    // Accept the friend request
    const response = await axios.post(`${API_BASE}/users/me/friend-requests/${requestId}/accept`, {}, {
      headers: { 'Authorization': `Bearer ${user2Token}` }
    });
    
    if (!response.data.success) {
      throw new Error('Failed to accept friend request');
    }
    
    console.log('   ✅ Friend request accepted successfully');
    console.log(`   🤝 ${user2.username} accepted ${user1.username}'s request`);

  } catch (error) {
    console.log('   ❌ Accept friend request failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testGetFriendsList() {
  console.log('\n👥 Testing get friends list...');
  
  try {
    // User 1 gets their friends list
    const response1 = await axios.get(`${API_BASE}/users/me/friends`, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    
    // User 2 gets their friends list
    const response2 = await axios.get(`${API_BASE}/users/me/friends`, {
      headers: { 'Authorization': `Bearer ${user2Token}` }
    });
    
    if (!response1.data.success || !response2.data.success) {
      throw new Error('Failed to get friends list');
    }
    
    if (response1.data.friends.length === 0 || response2.data.friends.length === 0) {
      throw new Error('Friends list is empty');
    }
    
    const user1Friend = response1.data.friends[0];
    const user2Friend = response2.data.friends[0];
    
    if (user1Friend.username !== user2.username || user2Friend.username !== user1.username) {
      throw new Error('Incorrect friends in list');
    }
    
    console.log('   ✅ Friends lists retrieved successfully');
    console.log(`   👤 ${user1.username} has ${response1.data.count} friends`);
    console.log(`   👤 ${user2.username} has ${response2.data.count} friends`);

  } catch (error) {
    console.log('   ❌ Get friends list failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testBlockUser() {
  console.log('\n🚫 Testing block user...');
  
  try {
    // User 1 blocks User 3
    const response = await axios.post(`${API_BASE}/users/${user3.id}/block`, {}, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    
    if (!response.data.success) {
      throw new Error('Failed to block user');
    }
    
    console.log('   ✅ User blocked successfully');
    console.log(`   🚫 ${user1.username} blocked ${user3.username}`);

  } catch (error) {
    console.log('   ❌ Block user failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testGetBlockedUsers() {
  console.log('\n📋 Testing get blocked users...');
  
  try {
    const response = await axios.get(`${API_BASE}/users/me/blocked`, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    
    if (!response.data.success) {
      throw new Error('Failed to get blocked users');
    }
    
    if (response.data.blockedUsers.length === 0) {
      throw new Error('Blocked users list is empty');
    }
    
    const blockedUser = response.data.blockedUsers[0];
    if (blockedUser.username !== user3.username) {
      throw new Error('Wrong user in blocked list');
    }
    
    console.log('   ✅ Blocked users retrieved successfully');
    console.log(`   📋 ${response.data.count} users blocked`);

  } catch (error) {
    console.log('   ❌ Get blocked users failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testUnblockUser() {
  console.log('\n✅ Testing unblock user...');
  
  try {
    const response = await axios.delete(`${API_BASE}/users/${user3.id}/block`, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    
    if (!response.data.success) {
      throw new Error('Failed to unblock user');
    }
    
    console.log('   ✅ User unblocked successfully');
    console.log(`   🔓 ${user1.username} unblocked ${user3.username}`);

  } catch (error) {
    console.log('   ❌ Unblock user failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testDeclineFriendRequest() {
  console.log('\n❌ Testing decline friend request...');
  
  try {
    // User 3 sends friend request to User 1
    await axios.post(`${API_BASE}/users/${user1.id}/friend-request`, {}, {
      headers: { 'Authorization': `Bearer ${user3Token}` }
    });
    
    // User 1 gets the request
    const requestsResponse = await axios.get(`${API_BASE}/users/me/friend-requests`, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    
    const requestId = requestsResponse.data.friendRequests[0].id;
    
    // Decline the request
    const response = await axios.post(`${API_BASE}/users/me/friend-requests/${requestId}/decline`, {}, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    
    if (!response.data.success) {
      throw new Error('Failed to decline friend request');
    }
    
    console.log('   ✅ Friend request declined successfully');
    console.log(`   ❌ ${user1.username} declined ${user3.username}'s request`);

  } catch (error) {
    console.log('   ❌ Decline friend request failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testRemoveFriend() {
  console.log('\n💔 Testing remove friend...');
  
  try {
    // User 1 removes User 2 as friend
    const response = await axios.delete(`${API_BASE}/users/me/friends/${user2.id}`, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    
    if (!response.data.success) {
      throw new Error('Failed to remove friend');
    }
    
    // Verify both users' friends lists are updated
    const friends1 = await axios.get(`${API_BASE}/users/me/friends`, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    
    const friends2 = await axios.get(`${API_BASE}/users/me/friends`, {
      headers: { 'Authorization': `Bearer ${user2Token}` }
    });
    
    if (friends1.data.friends.length > 0 || friends2.data.friends.length > 0) {
      throw new Error('Friend not removed from both lists');
    }
    
    console.log('   ✅ Friend removed successfully');
    console.log(`   💔 ${user1.username} removed ${user2.username} as friend`);

  } catch (error) {
    console.log('   ❌ Remove friend failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testDuplicateRequests() {
  console.log('\n🔄 Testing duplicate friend requests...');
  
  try {
    // Send initial request
    await axios.post(`${API_BASE}/users/${user2.id}/friend-request`, {}, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    
    // Try to send duplicate request (should fail)
    try {
      await axios.post(`${API_BASE}/users/${user2.id}/friend-request`, {}, {
        headers: { 'Authorization': `Bearer ${user1Token}` }
      });
      throw new Error('Duplicate friend request should have failed');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('   ✅ Duplicate friend request properly rejected');
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.log('   ❌ Duplicate request test failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function testBlockedUserInteractions() {
  console.log('\n🚫 Testing blocked user interactions...');
  
  try {
    // User 1 blocks User 2
    await axios.post(`${API_BASE}/users/${user2.id}/block`, {}, {
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    
    // User 2 tries to send friend request to User 1 (should fail)
    try {
      await axios.post(`${API_BASE}/users/${user1.id}/friend-request`, {}, {
        headers: { 'Authorization': `Bearer ${user2Token}` }
      });
      throw new Error('Blocked user should not be able to send friend request');
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log('   ✅ Blocked user properly prevented from sending friend request');
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.log('   ❌ Blocked user interaction test failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  // Note: In a real application, you might want to clean up test users
  // For now, we'll leave them as they'll be cleaned up by the cleanup script
  console.log('   ✅ Cleanup completed');
}

// Run tests
runFriendSystemTests();
