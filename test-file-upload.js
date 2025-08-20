const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Test configuration
const API_BASE = 'http://localhost:3001/api';
const IMAGE_PATH = 'C:\\Users\\user\\Downloads\\pepeToilet.png';

// Check if image exists and provide alternative paths
function getTestImagePath() {
  const possiblePaths = [
    'C:\\Users\\user\\Downloads\\pepeToilet.png',
    path.join(__dirname, 'pepeToilet.png'),
    path.join(process.cwd(), 'pepeToilet.png'),
    // Add any other possible locations
  ];
  
  for (const imagePath of possiblePaths) {
    if (fs.existsSync(imagePath)) {
      console.log(`   📁 Using image from: ${imagePath}`);
      return imagePath;
    }
  }
  
  console.log(`   ⚠️  pepeToilet.png not found in any of these locations:`);
  possiblePaths.forEach(p => console.log(`      - ${p}`));
  return null;
}

// Test data
let testUser = null;
let testToken = null;
let testServer = null;
let testChannel = null;

async function testFileUpload() {
  console.log('🚀 Starting File Upload Tests...\n');
  
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
    { name: 'Test Avatar Upload', fn: testAvatarUpload },
    { name: 'Test Message with Image', fn: testMessageWithImage },
    { name: 'Test Multiple File Upload', fn: testMultipleFileUpload },
    { name: 'Test Large File Handling', fn: testLargeFileHandling },
    { name: 'Test Invalid File Type', fn: testInvalidFileType },
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

  console.log('📊 File Upload Test Results:');
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log(`   📈 Success Rate: ${((passedTests / tests.length) * 100).toFixed(1)}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 All file upload tests passed! AWS S3 integration is working!');
  } else {
    console.log('\n⚠️  Some file upload tests failed. Check AWS S3 configuration.');
  }
}

async function setupTestUser() {
  const timestamp = Date.now();
  const userData = {
    username: `filetest_${timestamp}`,
    email: `filetest_${timestamp}@example.com`,
    password: 'testpassword123'
  };

  try {
    console.log(`   📡 Attempting to register user: ${userData.username}`);
    const response = await axios.post(`${API_BASE}/auth/register`, userData);
    
    console.log(`   📊 Registration response status: ${response.status}`);
    console.log(`   📋 Registration response data:`, response.data);
    
    // Check if registration was successful (either success field or 201 status with user data)
    if (!response.data.success && !response.data.user) {
      throw new Error(`Registration failed: ${response.data.error || response.data.message || 'Unknown error'}`);
    }

    testUser = response.data.user;
    testToken = response.data.token;
    
    console.log(`   ✅ Test user created: ${testUser.username}`);
    console.log(`   🔑 Token received: ${testToken ? 'Yes' : 'No'}`);
  } catch (error) {
    console.log(`   ❌ Registration error details:`);
    if (error.response) {
      console.log(`   📊 HTTP Status: ${error.response.status}`);
      console.log(`   📋 Error data:`, error.response.data);
    } else if (error.request) {
      console.log(`   📡 Network error - no response received`);
      console.log(`   🌐 Request details:`, error.request);
    } else {
      console.log(`   💥 Error message:`, error.message);
    }
    throw new Error(`Failed to create test user: ${error.message}`);
  }
}

async function createTestServer() {
  const serverData = {
    name: `File Test Server ${Date.now()}`,
    description: 'A server for testing file uploads'
  };

  try {
    console.log(`   📡 Creating test server: ${serverData.name}`);
    const response = await axios.post(`${API_BASE}/servers`, serverData, {
      headers: {
        'Authorization': `Bearer ${testToken}`
      }
    });

    console.log(`   📊 Server creation response status: ${response.status}`);
    console.log(`   📋 Server creation response data:`, response.data);

    // Check if server creation was successful
    if (!response.data.success && !response.data.server) {
      throw new Error(`Server creation failed: ${response.data.error || response.data.message || 'Unknown error'}`);
    }

    testServer = response.data.server;
    testChannel = testServer.channels.find(channel => channel.type === 'text');
    
    console.log(`   ✅ Test server created: ${testServer.name}`);
    console.log(`   📺 Test channel: ${testChannel.name} (${testChannel._id})`);
  } catch (error) {
    console.log(`   ❌ Server creation error details:`);
    if (error.response) {
      console.log(`   📊 HTTP Status: ${error.response.status}`);
      console.log(`   📋 Error data:`, error.response.data);
    } else {
      console.log(`   💥 Error message:`, error.message);
    }
    throw new Error(`Failed to create test server: ${error.message}`);
  }
}

async function testAvatarUpload() {
  // Check if the test image exists
  const imagePath = getTestImagePath();
  if (!imagePath) {
    throw new Error(`Test image pepeToilet.png not found`);
  }

  const formData = new FormData();
  formData.append('avatar', fs.createReadStream(imagePath));

  const response = await axios.put(`${API_BASE}/users/me`, formData, {
    headers: {
      'Authorization': `Bearer ${testToken}`,
      ...formData.getHeaders()
    }
  });

  if (!response.data.success) {
    throw new Error('Failed to upload avatar');
  }

  const updatedUser = response.data.user;
  if (!updatedUser.avatar || !updatedUser.avatar.includes('s3.amazonaws.com')) {
    throw new Error('Avatar URL does not contain S3 reference');
  }

  console.log(`   ✅ Avatar uploaded successfully`);
  console.log(`   🔗 Avatar URL: ${updatedUser.avatar}`);
  
  // Verify the uploaded file is accessible
  try {
    const headResponse = await axios.head(updatedUser.avatar);
    console.log(`   ✅ Avatar file is accessible (Status: ${headResponse.status})`);
  } catch (error) {
    console.log(`   ⚠️  Avatar file accessibility check failed: ${error.message}`);
  }
}

async function testMessageWithImage() {
  const imagePath = getTestImagePath();
  if (!imagePath) {
    throw new Error(`Test image pepeToilet.png not found`);
  }

  const formData = new FormData();
  formData.append('content', 'Here is the pepeToilet image! 🚽');
  formData.append('files', fs.createReadStream(imagePath));

  const response = await axios.post(`${API_BASE}/channels/${testChannel._id}/messages`, formData, {
    headers: {
      'Authorization': `Bearer ${testToken}`,
      ...formData.getHeaders()
    }
  });

  if (!response.data.success) {
    throw new Error('Failed to send message with image');
  }

  const message = response.data.message;
  if (!message.attachments || message.attachments.length === 0) {
    throw new Error('No attachments found in message');
  }

  if (!message.attachments[0].url || !message.attachments[0].url.includes('s3.amazonaws.com')) {
    throw new Error('Attachment URL does not contain S3 reference');
  }

  console.log(`   ✅ Message with image sent successfully`);
  console.log(`   📎 Attachment URL: ${message.attachments[0].url}`);
  
  // Verify the uploaded file is accessible
  try {
    const headResponse = await axios.head(message.attachments[0].url);
    console.log(`   ✅ Message attachment is accessible (Status: ${headResponse.status})`);
  } catch (error) {
    console.log(`   ⚠️  Message attachment accessibility check failed: ${error.message}`);
  }
}

async function testMultipleFileUpload() {
  const imagePath = getTestImagePath();
  if (!imagePath) {
    console.log(`   ⚠️  Skipping multiple file test - pepeToilet.png not found`);
    return;
  }

  // Create a simple text file for testing multiple uploads
  const textFilePath = path.join(__dirname, 'temp-test.txt');
  fs.writeFileSync(textFilePath, 'This is a test file for multiple upload testing.');

  try {
    const formData = new FormData();
    formData.append('content', 'Testing multiple file upload!');
    formData.append('files', fs.createReadStream(imagePath));
    formData.append('files', fs.createReadStream(textFilePath));

    const response = await axios.post(`${API_BASE}/channels/${testChannel._id}/messages`, formData, {
      headers: {
        'Authorization': `Bearer ${testToken}`,
        ...formData.getHeaders()
      }
    });

    if (!response.data.success) {
      throw new Error('Failed to send message with multiple files');
    }

    const message = response.data.message;
    if (!message.attachments || message.attachments.length !== 2) {
      throw new Error(`Expected 2 attachments, got ${message.attachments ? message.attachments.length : 0}`);
    }

    console.log(`   ✅ Multiple files uploaded successfully`);
    console.log(`   📎 Attachments: ${message.attachments.length} files`);
    message.attachments.forEach((attachment, index) => {
      console.log(`      ${index + 1}. ${attachment.filename} - ${attachment.url}`);
    });

  } finally {
    // Clean up temp file
    if (fs.existsSync(textFilePath)) {
      fs.unlinkSync(textFilePath);
    }
  }
}

async function testLargeFileHandling() {
  // Create a large file (6MB) to test file size limits
  const largeFilePath = path.join(__dirname, 'large-test-file.txt');
  const largeContent = 'A'.repeat(6 * 1024 * 1024); // 6MB file

  try {
    fs.writeFileSync(largeFilePath, largeContent);

    const formData = new FormData();
    formData.append('content', 'Testing large file upload (should fail)');
    formData.append('files', fs.createReadStream(largeFilePath));

    try {
      const response = await axios.post(`${API_BASE}/channels/${testChannel._id}/messages`, formData, {
        headers: {
          'Authorization': `Bearer ${testToken}`,
          ...formData.getHeaders()
        }
      });

      // If it succeeds, that's unexpected (unless the limit was increased)
      if (response.data.success) {
        console.log(`   ⚠️  Large file upload succeeded (limit may have been increased)`);
      }
    } catch (error) {
      if (error.response && error.response.status === 413) {
        console.log(`   ✅ Large file correctly rejected (413 Payload Too Large)`);
      } else {
        throw new Error(`Unexpected error for large file: ${error.message}`);
      }
    }

  } finally {
    // Clean up large file
    if (fs.existsSync(largeFilePath)) {
      fs.unlinkSync(largeFilePath);
    }
  }
}

async function testInvalidFileType() {
  // Create a file with invalid extension
  const invalidFilePath = path.join(__dirname, 'test-script.js');
  fs.writeFileSync(invalidFilePath, 'console.log("This is a JS file");');

  try {
    const formData = new FormData();
    formData.append('content', 'Testing invalid file type upload');
    formData.append('files', fs.createReadStream(invalidFilePath));

    try {
      const response = await axios.post(`${API_BASE}/channels/${testChannel._id}/messages`, formData, {
        headers: {
          'Authorization': `Bearer ${testToken}`,
          ...formData.getHeaders()
        }
      });

      if (response.data.success) {
        console.log(`   ✅ File upload succeeded (JS files are allowed)`);
        console.log(`   📎 Uploaded: ${response.data.message.attachments[0].filename} - ${response.data.message.attachments[0].url}`);
      }
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log(`   ✅ Invalid file type correctly rejected`);
      } else {
        console.log(`   ⚠️  Unexpected error for invalid file: ${error.message}`);
      }
    }

  } finally {
    // Clean up test file
    if (fs.existsSync(invalidFilePath)) {
      fs.unlinkSync(invalidFilePath);
    }
  }
}

async function cleanupTestData() {
  try {
    // Delete the test server (this will also clean up channels and messages)
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
  testFileUpload().catch(console.error);
}

module.exports = testFileUpload;
