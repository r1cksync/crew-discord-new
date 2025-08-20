// Database cleanup script for testing
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const User = require('./src/models/User');
const Server = require('./src/models/Server');
const Channel = require('./src/models/Channel');
const Message = require('./src/models/Message');
const Role = require('./src/models/Role');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
}

async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');

  try {
    // Delete test users (those created by test scripts)
    const testUserPattern = /^(test|socket)user/i;
    const testUsers = await User.find({
      $or: [
        { username: { $regex: testUserPattern } },
        { email: { $regex: /^(test|socket).*@example\.com$/i } }
      ]
    });

    console.log(`Found ${testUsers.length} test users to delete`);

    // Get test user IDs
    const testUserIds = testUsers.map(user => user._id);

    // Delete messages by test users
    const deletedMessages = await Message.deleteMany({
      author: { $in: testUserIds }
    });
    console.log(`Deleted ${deletedMessages.deletedCount} test messages`);

    // Delete servers owned by test users
    const testServers = await Server.find({
      owner: { $in: testUserIds }
    });
    console.log(`Found ${testServers.length} test servers to delete`);

    const testServerIds = testServers.map(server => server._id);

    // Delete channels in test servers
    const deletedChannels = await Channel.deleteMany({
      server: { $in: testServerIds }
    });
    console.log(`Deleted ${deletedChannels.deletedCount} test channels`);

    // Delete roles in test servers
    const deletedRoles = await Role.deleteMany({
      server: { $in: testServerIds }
    });
    console.log(`Deleted ${deletedRoles.deletedCount} test roles`);

    // Delete test servers
    const deletedServers = await Server.deleteMany({
      _id: { $in: testServerIds }
    });
    console.log(`Deleted ${deletedServers.deletedCount} test servers`);

    // Delete test users
    const deletedUsers = await User.deleteMany({
      _id: { $in: testUserIds }
    });
    console.log(`Deleted ${deletedUsers.deletedCount} test users`);

    console.log('✅ Test data cleanup completed');

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  }
}

async function cleanupAll() {
  console.log('⚠️  WARNING: This will delete ALL data in the database!');
  console.log('This is only for development/testing purposes.');
  
  try {
    await Message.deleteMany({});
    await Channel.deleteMany({});
    await Role.deleteMany({});
    await Server.deleteMany({});
    await User.deleteMany({});
    
    console.log('✅ All data deleted');
  } catch (error) {
    console.error('❌ Error during full cleanup:', error.message);
  }
}

async function main() {
  await connectDB();

  const args = process.argv.slice(2);
  
  if (args.includes('--all')) {
    await cleanupAll();
  } else {
    await cleanupTestData();
  }

  await mongoose.connection.close();
  console.log('Database connection closed');
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { cleanupTestData, cleanupAll };
