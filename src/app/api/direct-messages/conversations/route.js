const DirectMessage = require('../../../../models/DirectMessage');
const { DirectMessageConversation } = require('../../../../models/DirectMessage');
const User = require('../../../../models/User');
const { verifyToken, extractTokenFromHeader } = require('../../../../lib/jwt');
const connectDB = require('../../../../lib/mongodb');

// GET - List all DM conversations for the authenticated user
export async function GET(request) {
  try {
    await connectDB();
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return Response.json({ success: false, error: 'Access token is required' }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return Response.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
    const userId = decoded.userId;
    
    // Find all conversations where user is a participant
    const conversations = await DirectMessageConversation.find({
      participants: userId
    })
    .populate('participants', 'username avatar status')
    .populate('lastMessage', 'content createdAt author')
    .sort({ lastActivity: -1 });

    // Format conversations for response
    const formattedConversations = conversations.map(conv => {
      // Get the other participant (not the current user)
      const otherParticipant = conv.participants.find(p => p._id.toString() !== userId);
      
      return {
        conversationId: conv._id,
        user: otherParticipant,
        lastMessage: conv.lastMessage ? {
          content: conv.lastMessage.content,
          createdAt: conv.lastMessage.createdAt,
          author: conv.lastMessage.author
        } : null,
        lastActivity: conv.lastActivity
      };
    });
    
    return Response.json({ success: true, conversations: formattedConversations });
  } catch (error) {
    console.error('List DM conversations error:', error);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
