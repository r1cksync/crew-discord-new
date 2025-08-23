/**
 * Very simple model test - just test the DirectMessage model directly
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('✅ MongoDB Connected');
    }
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
};

const testDirectMessageModel = async () => {
  console.log('🧪 Testing DirectMessage model...');
  
  try {
    await connectDB();

    // Import models
    const DirectMessage = require('./src/models/DirectMessage');
    const DirectMessageConversation = DirectMessage.DirectMessageConversation;
    
    console.log('✅ Models imported successfully');
    console.log('DirectMessage model:', typeof DirectMessage);
    console.log('DirectMessageConversation model:', typeof DirectMessageConversation);

    // Test creating a conversation
    const testConversation = new DirectMessageConversation({
      participants: ['68a77047702a35fd70fe7612', '68a77049702a35fd70fe7618']
    });

    await testConversation.save();
    console.log('✅ Test conversation created:', testConversation._id);

    // Test creating a direct message
    const testMessage = new DirectMessage({
      content: 'Test message from model test',
      author: '68a77047702a35fd70fe7612',
      conversation: testConversation._id
    });

    await testMessage.save();
    console.log('✅ Test message created:', testMessage._id);

    // Clean up
    await DirectMessage.findByIdAndDelete(testMessage._id);
    await DirectMessageConversation.findByIdAndDelete(testConversation._id);
    console.log('✅ Test cleanup completed');

    console.log('🎉 DirectMessage model test passed!');

  } catch (error) {
    console.error('💥 Model test failed:', error);
  } finally {
    await mongoose.connection.close();
  }
};

testDirectMessageModel();
