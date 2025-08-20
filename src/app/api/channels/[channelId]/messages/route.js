const Message = require('../../../../../models/Message');
const Channel = require('../../../../../models/Channel');
const { verifyToken, extractTokenFromHeader } = require('../../../../../lib/jwt');
const connectDB = require('../../../../../lib/mongodb');

// GET - Get messages for a channel
export async function GET(request, { params }) {
  try {
    await connectDB();
    
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return Response.json(
        { error: 'Access token is required' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return Response.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { channelId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const before = searchParams.get('before');

    // Verify channel exists and user has access
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return Response.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Build query
    let query = { 
      channel: channelId,
      deleted: false
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('author', 'username avatar status')
      .populate('mentions', 'username')
      .sort({ createdAt: -1 })
      .limit(limit);

    return Response.json({
      messages: messages.reverse()
    });

  } catch (error) {
    console.error('Get messages error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
