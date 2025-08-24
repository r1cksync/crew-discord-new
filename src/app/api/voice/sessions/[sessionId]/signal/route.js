const VoiceSession = require('../../../../../../models/VoiceSession');
const { verifyToken, extractTokenFromHeader } = require('../../../../../../lib/jwt');
const connectDB = require('../../../../../../lib/mongodb');
const { getIO } = require('../../../../../../socket');

// POST - Handle WebRTC signaling (offer, answer, ice-candidate)
export async function POST(request, { params }) {
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

    const { sessionId } = params;
    const body = await request.json();
    const { type, targetUserId, signal } = body;

    // Validate input
    if (!type || !targetUserId || !signal) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Type, targetUserId, and signal are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Find the session
    const session = await VoiceSession.findOne({ sessionId })
      .populate('activeUsers.user', 'username avatar');

    if (!session) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Voice session not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if both users are in the session
    const senderInSession = session.activeUsers.find(u => u.user._id.toString() === decoded.userId);
    const targetInSession = session.activeUsers.find(u => u.user._id.toString() === targetUserId);

    if (!senderInSession) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You are not in this voice session'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!targetInSession) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Target user is not in this voice session'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get Socket.io instance and send signaling data
    const io = getIO();
    if (!io) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Real-time communication not available'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Send signaling data to target user
    const signalingData = {
      sessionId: session.sessionId,
      type: type, // 'offer', 'answer', 'ice-candidate'
      signal: signal,
      fromUserId: decoded.userId,
      fromUsername: senderInSession.user.username,
      timestamp: new Date()
    };

    // Send to specific user's socket
    io.to(`user:${targetUserId}`).emit('webrtc-signal', signalingData);

    console.log(`📡 WebRTC signal sent: ${type} from ${decoded.userId} to ${targetUserId} in session ${sessionId}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Signaling data sent successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('WebRTC signaling error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to send signaling data'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
