#!/usr/bin/env node

// Master test runner for Discord Clone Backend
const { spawn } = require('child_process');
const path = require('path');

console.log('🎯 Discord Clone Backend - Master Test Suite\n');

function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd: __dirname
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function checkServerRunning() {
  const axios = require('axios');
  try {
    await axios.get('http://localhost:3001');
    return true;
  } catch (error) {
    return false;
  }
}

async function runTests() {
  console.log('🔍 Checking if server is running...');
  
  const isServerRunning = await checkServerRunning();
  if (!isServerRunning) {
    console.log('❌ Server is not running. Please start the server with: npm run dev');
    process.exit(1);
  }
  
  console.log('✅ Server is running\n');

  const tests = [
    {
      name: 'Basic API Tests',
      command: 'node',
      args: ['test-backend.js'],
      description: 'Tests core API endpoints'
    },
    {
      name: 'Comprehensive API Tests',
      command: 'node',
      args: ['test-comprehensive.js'],
      description: 'Tests all API functionality with edge cases'
    },
    {
      name: 'Socket.io Real-time Tests',
      command: 'node',
      args: ['test-socket.js'],
      description: 'Tests real-time messaging and Socket.io events'
    },
    {
      name: 'File Upload Tests',
      command: 'node',
      args: ['test-file-upload.js'],
      description: 'Tests AWS S3 file upload functionality'
    },
    {
      name: 'Invite Management Tests',
      command: 'node',
      args: ['test-invite-management.js'],
      description: 'Tests server invite system and validation'
    },
    {
      name: 'Moderation System Tests',
      command: 'node',
      args: ['test-moderation.js'],
      description: 'Tests kick, ban, timeout, warn, and role management'
    },
    {
      name: 'Friend System Tests',
      command: 'node',
      args: ['test-friends.js'],
      description: 'Tests friend requests, blocking, and social features'
    }
  ];

  let totalPassed = 0;
  let totalFailed = 0;

  for (const test of tests) {
    console.log(`🧪 Running ${test.name}...`);
    console.log(`   📝 ${test.description}\n`);

    try {
      await runCommand(test.command, test.args);
      console.log(`✅ ${test.name} - COMPLETED\n`);
      totalPassed++;
    } catch (error) {
      console.log(`❌ ${test.name} - FAILED\n`);
      totalFailed++;
    }
  }

  console.log('=' .repeat(60));
  console.log('📊 FINAL TEST RESULTS');
  console.log('=' .repeat(60));
  console.log(`✅ Test Suites Passed: ${totalPassed}`);
  console.log(`❌ Test Suites Failed: ${totalFailed}`);
  console.log(`📈 Overall Success Rate: ${((totalPassed / tests.length) * 100).toFixed(1)}%`);

  if (totalFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! 🎉');
    console.log('Your Discord clone backend is working perfectly!');
    console.log('\n🚀 Ready for production deployment!');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the output above.');
    console.log('💡 Common issues:');
    console.log('   • MongoDB not running');
    console.log('   • Environment variables not configured');
    console.log('   • AWS S3 credentials not set up');
    console.log('   • Server not accessible on port 3001');
  }

  console.log('\n📋 Next Steps:');
  console.log('   1. Set up MongoDB database');
  console.log('   2. Configure AWS S3 for file uploads');
  console.log('   3. Set up environment variables');
  console.log('   4. Test with real Discord client');
  console.log('   5. Deploy to production');
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch((error) => {
    console.error('Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = runTests;
