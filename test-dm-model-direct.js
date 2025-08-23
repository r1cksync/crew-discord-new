/**
 * Direct Test of DirectMessage Model
 */

const mongoose = require('mongoose');
const { DirectMessageConversation, DirectMessage } = require('./src/models/DirectMessage');
const User = require('./src/models/User');
require('dotenv').config({ path: '.env.local' });

const test = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test user IDs (from previous tests)
    const user1Id = '68a77047702a35fd70fe7612';
    const user2Id = '68a77049702a35fd70fe7618';

    console.log('👥 Finding users...');
    const user1 = await User.findById(user1Id);
    const user2 = await User.findById(user2Id);
    
    if (!user1 || !user2) {
      console.error('❌ Users not found');
      return;
    }
    
    console.log('✅ Users found:', user1.username, user2.username);

    console.log('💬 Creating conversation...');
    const conversation = new DirectMessageConversation({
      participants: [user1Id, user2Id]
    });
    
    await conversation.save();
    console.log('✅ Conversation created:', conversation._id);

    console.log('📝 Creating message...');
    const message = new DirectMessage({
      content: 'Test message from direct model test',
      author: user1Id,
      conversation: conversation._id
    });

    await message.save();
    console.log('✅ Message created:', message._id);

    console.log('📊 Message details:', {
      id: message._id,
      content: message.content,
      author: message.author,
      conversation: message.conversation,
      createdAt: message.createdAt
    });

    console.log('🎉 Direct model test successful!');

  } catch (error) {
    console.error('💥 Model test failed:', error);
  } finally {
    mongoose.disconnect();
  }
};

test();
