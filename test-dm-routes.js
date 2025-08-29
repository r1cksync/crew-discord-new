const axios = require('axios');
const mongoose = require('mongoose');

// Test configuration
const BASE_URL = 'http://localhost:3001/api';
let authTokenUser1, authTokenUser2, authTokenUser3;
let userId1, userId2, userId3;

// Test data
const testUsers = [
  {
    username: 'dmtester1',
    email: 'dmtester1@test.com',
    password: 'testpass123'
  },
  {
    username: 'dmtester2', 
    email: 'dmtester2@test.com',
    password: 'testpass123'
  },
  {
    username: 'dmtester3',
    email: 'dmtester3@test.com', 
    password: 'testpass123'
  }
];

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const makeRequest = async (method, url, data = null, token = null) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {}
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
      config.headers['Content-Type'] = 'application/json';
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
};

// Test functions
async function registerAndLoginUsers() {
  console.log('\n🔐 Registering and logging in test users...');
  
  try {
    // Register users
    for (let i = 0; i < testUsers.length; i++) {
      const registerResult = await makeRequest('POST', '/auth/register', testUsers[i]);
      if (!registerResult.success) {
        console.log(`⚠️ User ${testUsers[i].username} already exists, attempting login...`);
      }
      
      // Login users
      const loginResult = await makeRequest('POST', '/auth/login', {
        email: testUsers[i].email,
        password: testUsers[i].password
      });
      
      if (loginResult.success) {
        if (i === 0) {
          authTokenUser1 = loginResult.data.token;
          userId1 = loginResult.data.user.id;
        } else if (i === 1) {
          authTokenUser2 = loginResult.data.token;
          userId2 = loginResult.data.user.id;
        } else {
          authTokenUser3 = loginResult.data.token;
          userId3 = loginResult.data.user.id;
        }
        console.log(`✅ ${testUsers[i].username} logged in successfully`);
      } else {
        throw new Error(`Failed to login ${testUsers[i].username}: ${loginResult.error}`);
      }
    }
    
    console.log(`✅ All users authenticated successfully`);
    return true;
  } catch (error) {
    console.error('❌ Authentication setup failed:', error.message);
    return false;
  }
}

async function testSendDirectMessage() {
  console.log('\n📨 Testing Send Direct Message...');
  
  try {
    // User1 sends message to User2
    const result = await makeRequest('POST', '/direct-messages', {
      content: 'Hello User2! This is a test message.',
      recipientId: userId2
    }, authTokenUser1);
    
    if (result.success) {
      console.log('✅ Direct message sent successfully');
      console.log(`   Message ID: ${result.data.directMessage.id}`);
      console.log(`   Content: ${result.data.directMessage.content}`);
      return true;
    } else {
      console.log('❌ Failed to send direct message:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Send direct message test failed:', error.message);
    return false;
  }
}

async function testSendMultipleMessages() {
  console.log('\n📨 Testing Multiple Direct Messages...');
  
  try {
    const messages = [
      { from: 1, to: 2, content: 'Hey there! How are you doing?' },
      { from: 2, to: 1, content: 'I am doing great! Thanks for asking.' },
      { from: 1, to: 3, content: 'Hello User3! Nice to meet you.' },
      { from: 3, to: 1, content: 'Nice to meet you too!' },
      { from: 2, to: 3, content: 'Hi User3! Welcome to the chat.' },
      { from: 3, to: 2, content: 'Thank you for the welcome!' }
    ];
    
    let successCount = 0;
    
    for (const msg of messages) {
      const token = msg.from === 1 ? authTokenUser1 : msg.from === 2 ? authTokenUser2 : authTokenUser3;
      const recipientId = msg.to === 1 ? userId1 : msg.to === 2 ? userId2 : userId3;
      
      const result = await makeRequest('POST', '/direct-messages', {
        content: msg.content,
        recipientId: recipientId
      }, token);
      
      if (result.success) {
        successCount++;
        console.log(`✅ Message sent: "${msg.content.substring(0, 30)}..."`);
      } else {
        console.log(`❌ Failed to send message: ${result.error}`);
      }
      
      await delay(100); // Small delay between messages
    }
    
    console.log(`✅ ${successCount}/${messages.length} messages sent successfully`);
    return successCount === messages.length;
  } catch (error) {
    console.error('❌ Multiple messages test failed:', error.message);
    return false;
  }
}

async function testGetDirectMessages() {
  console.log('\n📬 Testing Get Direct Messages...');
  
  try {
    // User1 gets messages with User2
    const result = await makeRequest('GET', `/direct-messages?recipient=${userId2}`, null, authTokenUser1);
    
    if (result.success) {
      console.log('✅ Direct messages retrieved successfully');
      console.log(`   Found ${result.data.messages.length} messages`);
      console.log(`   Recipient: ${result.data.recipient.username}`);
      
      if (result.data.messages.length > 0) {
        console.log(`   Latest message: "${result.data.messages[result.data.messages.length - 1].content}"`);
      }
      return true;
    } else {
      console.log('❌ Failed to get direct messages:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Get direct messages test failed:', error.message);
    return false;
  }
}

async function testGetConversations() {
  console.log('\n💬 Testing Get DM Conversations...');
  
  try {
    // User1 gets all their conversations
    const result = await makeRequest('GET', '/direct-messages/conversations', null, authTokenUser1);
    
    if (result.success) {
      console.log('✅ DM conversations retrieved successfully');
      console.log(`   Found ${result.data.conversations.length} conversations`);
      
      result.data.conversations.forEach((conv, index) => {
        console.log(`   Conversation ${index + 1}:`);
        console.log(`     User: ${conv.user.username}`);
        console.log(`     Status: ${conv.user.status || 'offline'}`);
        if (conv.lastMessage) {
          console.log(`     Last message: "${conv.lastMessage.content}"`);
          console.log(`     Sent at: ${new Date(conv.lastMessage.createdAt).toLocaleString()}`);
        } else {
          console.log(`     No messages found`);
        }
      });
      
      return true;
    } else {
      console.log('❌ Failed to get conversations:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Get conversations test failed:', error.message);
    return false;
  }
}

async function testConversationsForAllUsers() {
  console.log('\n💬 Testing Conversations for All Users...');
  
  try {
    const users = [
      { token: authTokenUser1, name: 'User1' },
      { token: authTokenUser2, name: 'User2' },
      { token: authTokenUser3, name: 'User3' }
    ];
    
    let successCount = 0;
    
    for (const user of users) {
      const result = await makeRequest('GET', '/direct-messages/conversations', null, user.token);
      
      if (result.success) {
        console.log(`✅ ${user.name} has ${result.data.conversations.length} conversations`);
        successCount++;
      } else {
        console.log(`❌ Failed to get conversations for ${user.name}:`, result.error);
      }
    }
    
    return successCount === users.length;
  } catch (error) {
    console.error('❌ Conversations for all users test failed:', error.message);
    return false;
  }
}

async function testInvalidRequests() {
  console.log('\n🚫 Testing Invalid Requests...');
  
  try {
    let passCount = 0;
    
    // Test 1: Send message without token
    const noTokenResult = await makeRequest('POST', '/direct-messages', {
      content: 'This should fail',
      recipientId: userId2
    });
    
    if (!noTokenResult.success && noTokenResult.status === 401) {
      console.log('✅ No token request properly rejected');
      passCount++;
    } else {
      console.log('❌ No token request should have been rejected');
    }
    
    // Test 2: Send message with invalid token
    const invalidTokenResult = await makeRequest('POST', '/direct-messages', {
      content: 'This should fail',
      recipientId: userId2
    }, 'invalid-token');
    
    if (!invalidTokenResult.success && invalidTokenResult.status === 401) {
      console.log('✅ Invalid token request properly rejected');
      passCount++;
    } else {
      console.log('❌ Invalid token request should have been rejected');
    }
    
    // Test 3: Send message without recipient
    const noRecipientResult = await makeRequest('POST', '/direct-messages', {
      content: 'This should fail'
    }, authTokenUser1);
    
    if (!noRecipientResult.success && noRecipientResult.status === 400) {
      console.log('✅ No recipient request properly rejected');
      passCount++;
    } else {
      console.log('❌ No recipient request should have been rejected');
    }
    
    // Test 4: Send message without content
    const noContentResult = await makeRequest('POST', '/direct-messages', {
      recipientId: userId2
    }, authTokenUser1);
    
    if (!noContentResult.success && noContentResult.status === 400) {
      console.log('✅ No content request properly rejected');
      passCount++;
    } else {
      console.log('❌ No content request should have been rejected');
    }
    
    // Test 5: Get messages without recipient parameter
    const noRecipientGetResult = await makeRequest('GET', '/direct-messages', null, authTokenUser1);
    
    if (!noRecipientGetResult.success && noRecipientGetResult.status === 400) {
      console.log('✅ Get messages without recipient properly rejected');
      passCount++;
    } else {
      console.log('❌ Get messages without recipient should have been rejected');
    }
    
    // Test 6: Get conversations without token
    const noTokenConvResult = await makeRequest('GET', '/direct-messages/conversations');
    
    if (!noTokenConvResult.success && noTokenConvResult.status === 401) {
      console.log('✅ Get conversations without token properly rejected');
      passCount++;
    } else {
      console.log('❌ Get conversations without token should have been rejected');
    }
    
    console.log(`✅ ${passCount}/6 invalid request tests passed`);
    return passCount === 6;
  } catch (error) {
    console.error('❌ Invalid requests test failed:', error.message);
    return false;
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Note: In a real scenario, you might want to clean up test users and messages
    // For now, we'll just log the cleanup
    console.log('✅ Cleanup completed (test users and messages remain for inspection)');
    return true;
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Direct Messages Routes Test Suite');
  console.log('============================================');
  
  const testResults = [];
  
  // Setup
  testResults.push(await registerAndLoginUsers());
  
  // Core functionality tests
  testResults.push(await testSendDirectMessage());
  testResults.push(await testSendMultipleMessages());
  testResults.push(await testGetDirectMessages());
  testResults.push(await testGetConversations());
  testResults.push(await testConversationsForAllUsers());
  
  // Error handling tests
  testResults.push(await testInvalidRequests());
  
  // Cleanup
  testResults.push(await cleanup());
  
  // Results summary
  const passedTests = testResults.filter(result => result === true).length;
  const totalTests = testResults.length;
  
  console.log('\n📊 Test Results Summary');
  console.log('======================');
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Direct Messages functionality is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the logs above for details.');
  }
  
  process.exit(passedTests === totalTests ? 0 : 1);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testSendDirectMessage,
  testGetDirectMessages,
  testGetConversations,
  testInvalidRequests
};
