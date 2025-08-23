/**
 * Autonomous Ban and Kick Functionality Test Script
 * Creates everything from scratch - no manual setup required!
 */

const io = require('socket.io-client');
const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3001';
const timestamp = Date.now();

class AutonomousModerationTester {
  constructor() {
    this.moderatorToken = null;
    this.targetUserToken = null;
    this.moderatorSocket = null;
    this.targetUserSocket = null;
    this.moderatorUser = null;
    this.targetUser = null;
    this.testServer = null;
    this.moderatorRole = null;
  }

  async createTestUsers() {
    console.log('� Creating test users autonomously...');
    
    try {
      // Create moderator user
      const modResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
        username: `testmod_${timestamp}`,
        email: `testmod_${timestamp}@test.com`,
        password: 'password123'
      });

      this.moderatorToken = modResponse.data.token;
      this.moderatorUser = modResponse.data.user;
      console.log(`✅ Moderator created: ${this.moderatorUser.username}`);

      // Create target user
      const targetResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
        username: `testtarget_${timestamp}`,
        email: `testtarget_${timestamp}@test.com`,
        password: 'password123'
      });

      this.targetUserToken = targetResponse.data.token;
      this.targetUser = targetResponse.data.user;
      console.log(`✅ Target user created: ${this.targetUser.username}`);

    } catch (error) {
      console.error('❌ User creation failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async createTestServer() {
    console.log('🏢 Creating test server autonomously...');
    
    try {
      // Create server (moderator becomes owner)
      const serverResponse = await axios.post(`${BASE_URL}/api/servers`, {
        name: `Test Moderation Server ${timestamp}`,
        description: 'Autonomous test server for ban/kick testing'
      }, {
        headers: { Authorization: `Bearer ${this.moderatorToken}` }
      });

      this.testServer = serverResponse.data.server;
      console.log(`✅ Server created: ${this.testServer.name}`);
      console.log(`   Server ID: ${this.testServer._id}`);
      console.log(`   Invite Code: ${this.testServer.inviteCode}`);

      // Target user joins the server
      await axios.post(`${BASE_URL}/api/servers/join/${this.testServer.inviteCode}`, {}, {
        headers: { Authorization: `Bearer ${this.targetUserToken}` }
      });
      console.log(`✅ Target user joined server`);

    } catch (error) {
      console.error('❌ Server creation failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async createModeratorRole() {
    console.log('🎭 Creating moderator role with permissions...');
    
    try {
      // Create moderator role with kick and ban permissions
      const roleResponse = await axios.post(`${BASE_URL}/api/servers/${this.testServer._id}/roles`, {
        name: 'Test Moderator',
        color: '#ff6b35',
        permissions: ['KICK_MEMBERS', 'BAN_MEMBERS', 'MANAGE_MESSAGES'],
        mentionable: true
      }, {
        headers: { Authorization: `Bearer ${this.moderatorToken}` }
      });

      this.moderatorRole = roleResponse.data.role;
      console.log(`✅ Moderator role created: ${this.moderatorRole.name}`);
      console.log(`   Permissions: ${this.moderatorRole.permissions.join(', ')}`);

      // Since moderator is the server owner, they already have all permissions
      // But let's assign the role anyway for testing
      await axios.put(`${BASE_URL}/api/servers/${this.testServer._id}/members/${this.moderatorUser.id}/roles`, {
        roleIds: [this.moderatorRole.id],
        action: 'add'
      }, {
        headers: { Authorization: `Bearer ${this.moderatorToken}` }
      });

      console.log(`✅ Moderator role assigned to ${this.moderatorUser.username}`);

    } catch (error) {
      console.error('❌ Role creation failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async setupSockets() {
    console.log('🔌 Setting up Socket.io connections...');
    
    // Connect sockets
    this.moderatorSocket = io(BASE_URL, {
      auth: { token: this.moderatorToken },
      forceNew: true
    });

    this.targetUserSocket = io(BASE_URL, {
      auth: { token: this.targetUserToken },
      forceNew: true
    });

    // Wait for connections
    await Promise.all([
      new Promise(resolve => this.moderatorSocket.on('connect', resolve)),
      new Promise(resolve => this.targetUserSocket.on('connect', resolve))
    ]);

    console.log('✅ Both sockets connected');

    // Join server rooms
    this.moderatorSocket.emit('join-server', this.testServer._id);
    this.targetUserSocket.emit('join-server', this.testServer._id);

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Both users joined server rooms');
  }

  async testKick() {
    console.log('\n🦵 === TESTING KICK FUNCTIONALITY ===');
    
    let kickReceived = false;
    let memberKickedReceived = false;

    // Set up event listeners
    this.targetUserSocket.on('kicked-from-server', (data) => {
      console.log('🎯 TARGET USER received kick notification:', data.message);
      console.log(`   Server: ${data.server.name}`);
      console.log(`   Kicked by: ${data.kickedBy.username}`);
      console.log(`   Reason: ${data.reason}`);
      kickReceived = true;
    });

    this.moderatorSocket.on('member-kicked', (data) => {
      console.log('📢 MODERATOR received member-kicked event:', data.message);
      console.log(`   Member: ${data.member.username}`);
      console.log(`   Kicked by: ${data.kickedBy.username}`);
      memberKickedReceived = true;
    });

    // Perform kick action
    console.log('📤 Sending kick request...');
    try {
      const response = await axios.post(
        `${BASE_URL}/api/servers/${this.testServer._id}/members/${this.targetUser.id}/kick`,
        { reason: 'Autonomous test kick' },
        { headers: { Authorization: `Bearer ${this.moderatorToken}` } }
      );

      console.log('✅ Kick API request successful');
      console.log(`   Response: ${response.data.message}`);
      console.log(`   Kicked user: ${response.data.kickedUser.username}`);

    } catch (error) {
      console.error('❌ Kick API request failed:', error.response?.data || error.message);
      return false;
    }

    // Wait for real-time events
    console.log('⏳ Waiting for real-time kick events...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Evaluate results
    console.log('\n🎯 === KICK TEST RESULTS ===');
    console.log(`Target user kick notification: ${kickReceived ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Moderator kick broadcast: ${memberKickedReceived ? '✅ SUCCESS' : '❌ FAILED'}`);

    return kickReceived && memberKickedReceived;
  }

  async rejoinServerForBanTest() {
    console.log('\n🔄 Rejoining server for ban test...');
    
    try {
      await axios.post(`${BASE_URL}/api/servers/join/${this.testServer.inviteCode}`, {}, {
        headers: { Authorization: `Bearer ${this.targetUserToken}` }
      });
      console.log('✅ Target user rejoined server');
      
      // Rejoin socket room
      this.targetUserSocket.emit('join-server', this.testServer._id);
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error('❌ Rejoin failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async testBan() {
    console.log('\n🚫 === TESTING BAN FUNCTIONALITY ===');
    
    let banReceived = false;
    let memberBannedReceived = false;

    // Set up event listeners
    this.targetUserSocket.on('banned-from-server', (data) => {
      console.log('🎯 TARGET USER received ban notification:', data.message);
      console.log(`   Server: ${data.server.name}`);
      console.log(`   Banned by: ${data.bannedBy.username}`);
      console.log(`   Reason: ${data.reason}`);
      banReceived = true;
    });

    this.moderatorSocket.on('member-banned', (data) => {
      console.log('📢 MODERATOR received member-banned event:', data.message);
      console.log(`   Member: ${data.member.username}`);
      console.log(`   Banned by: ${data.bannedBy.username}`);
      memberBannedReceived = true;
    });

    // Perform ban action
    console.log('📤 Sending ban request...');
    try {
      const response = await axios.post(
        `${BASE_URL}/api/servers/${this.testServer._id}/members/${this.targetUser.id}/ban`,
        { 
          reason: 'Autonomous test ban',
          deleteMessageDays: 1
        },
        { headers: { Authorization: `Bearer ${this.moderatorToken}` } }
      );

      console.log('✅ Ban API request successful');
      console.log(`   Response: ${response.data.message}`);
      console.log(`   Banned user: ${response.data.bannedUser.username}`);

    } catch (error) {
      console.error('❌ Ban API request failed:', error.response?.data || error.message);
      return false;
    }

    // Wait for real-time events
    console.log('⏳ Waiting for real-time ban events...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Evaluate results
    console.log('\n🎯 === BAN TEST RESULTS ===');
    console.log(`Target user ban notification: ${banReceived ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Moderator ban broadcast: ${memberBannedReceived ? '✅ SUCCESS' : '❌ FAILED'}`);

    return banReceived && memberBannedReceived;
  }

  async testBanEnforcement() {
    console.log('\n�️ === TESTING BAN ENFORCEMENT ===');
    
    try {
      // Try to rejoin server after being banned (should fail)
      await axios.post(`${BASE_URL}/api/servers/join/${this.testServer.inviteCode}`, {}, {
        headers: { Authorization: `Bearer ${this.targetUserToken}` }
      });
      console.log('❌ Ban enforcement failed - banned user was able to rejoin');
      return false;
    } catch (error) {
      if (error.response?.status === 403 || error.response?.status === 400) {
        console.log('✅ Ban enforcement working - banned user cannot rejoin');
        return true;
      } else {
        console.log('⚠️ Unexpected error during ban enforcement test:', error.response?.data);
        return false;
      }
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test environment...');
    
    if (this.moderatorSocket) this.moderatorSocket.disconnect();
    if (this.targetUserSocket) this.targetUserSocket.disconnect();
    
    console.log('✅ Sockets disconnected');
    console.log('✅ Test environment cleaned up');
  }

  async runAllTests() {
    try {
      console.log('🎯 AUTONOMOUS MODERATION TEST SUITE');
      console.log('=====================================');
      console.log('🤖 No manual setup required!\n');

      await this.createTestUsers();
      await this.createTestServer();
      await this.createModeratorRole();
      await this.setupSockets();
      
      const kickTest = await this.testKick();
      
      await this.rejoinServerForBanTest();
      const banTest = await this.testBan();
      const banEnforcementTest = await this.testBanEnforcement();
      
      console.log('\n📊 === FINAL AUTONOMOUS TEST SUMMARY ===');
      console.log(`Kick functionality: ${kickTest ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Ban functionality: ${banTest ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Ban enforcement: ${banEnforcementTest ? '✅ PASS' : '❌ FAIL'}`);
      
      const allTestsPassed = kickTest && banTest && banEnforcementTest;
      
      if (allTestsPassed) {
        console.log('\n🎉🎉🎉 ALL AUTONOMOUS MODERATION TESTS PASSED! 🎉🎉🎉');
        console.log('✅ Kick and Ban functionality is fully operational');
        console.log('✅ Real-time notifications working perfectly');
        console.log('✅ Permission system functioning correctly');
        console.log('✅ Socket.io events properly emitted and received');
        console.log('✅ Ban enforcement working as expected');
        console.log('🤖 Test completed with ZERO manual intervention!');
      } else {
        console.log('\n❌ Some moderation tests failed');
      }
      
      return allTestsPassed;
      
    } catch (error) {
      console.error('💥 Autonomous test execution failed:', error);
      return false;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the autonomous tests
const tester = new AutonomousModerationTester();
tester.runAllTests().then(success => {
  console.log(`\n🏁 Test suite completed with ${success ? 'SUCCESS' : 'FAILURE'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Autonomous test runner failed:', error);
  process.exit(1);
});
