const VoiceSession = require('../../../../models/VoiceSession');
const User = require('../../../../models/User');
const { verifyToken, extractTokenFromHeader } = require('../../../../lib/jwt');
const connectDB = require('../../../../lib/mongodb');
const { getIO } = require('../../../../socket');

// POST - Initiate a DM call
export async function POST(request) {
  try {
    await connectDB();
    
    const token = extractTokenFromHeader(request);
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid token'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { recipientId, isVideoCall = false } = body;

    if (!recipientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Recipient ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId).select('username avatar status');
    if (!recipient) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Recipient not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const caller = await User.findById(decoded.userId).select('username avatar');

    // Check if there's already an active call between these users
    const existingSession = await VoiceSession.findOne({
      type: 'dm',
      participants: { $all: [decoded.userId, recipientId] },
      isActive: true
    });

    if (existingSession) {
      return new Response(JSON.stringify({
        success: false,
        error: 'There is already an active call between you and this user'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create new DM call session
    const session = new VoiceSession({
      sessionId: `dm_call_${decoded.userId}_${recipientId}_${Date.now()}`,
      type: 'dm',
      participants: [decoded.userId, recipientId],
      createdBy: decoded.userId,
      activeUsers: []
    });

    await session.save();

    // Get Socket.io instance and notify recipient
    const io = getIO();
    if (io) {
      io.to(`user:${recipientId}`).emit('dm-call-incoming', {
        sessionId: session.sessionId,
        caller: {
          id: decoded.userId,
          username: caller.username,
          avatar: caller.avatar
        },
        isVideoCall: isVideoCall,
        timestamp: new Date()
      });

      console.log(`📞 DM call initiated: ${caller.username} calling ${recipient.username} (Video: ${isVideoCall})`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'DM call initiated successfully',
      session: {
        id: session._id,
        sessionId: session.sessionId,
        recipient: {
          id: recipientId,
          username: recipient.username,
          avatar: recipient.avatar,
          status: recipient.status
        },
        isVideoCall: isVideoCall
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Initiate DM call error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to initiate DM call'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
