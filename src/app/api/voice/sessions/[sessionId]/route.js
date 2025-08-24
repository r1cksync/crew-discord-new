const VoiceSession = require('../../../../../models/VoiceSession');
const { verifyToken, extractTokenFromHeader } = require('../../../../../lib/jwt');
const connectDB = require('../../../../../lib/mongodb');
const { getIO } = require('../../../../../socket');

// PUT - Update voice session (mute, video, etc.)
export async function PUT(request, { params }) {
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
    const { isMuted, isDeafened, isVideoEnabled, isScreenSharing } = body;

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

    // Check if user is in the session
    const userInSession = session.activeUsers.find(u => u.user._id.toString() === decoded.userId);
    if (!userInSession) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You are not in this voice session'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update user state
    const updates = {};
    if (typeof isMuted === 'boolean') updates.isMuted = isMuted;
    if (typeof isDeafened === 'boolean') updates.isDeafened = isDeafened;
    if (typeof isVideoEnabled === 'boolean') updates.isVideoEnabled = isVideoEnabled;
    if (typeof isScreenSharing === 'boolean') updates.isScreenSharing = isScreenSharing;

    await session.updateUserState(decoded.userId, updates);

    // Get Socket.io instance and notify other users
    const io = getIO();
    if (io) {
      const eventData = {
        sessionId: session.sessionId,
        userId: decoded.userId,
        username: userInSession.user.username,
        ...updates,
        timestamp: new Date()
      };

      if (session.type === 'channel') {
        io.to(`server:${session.server}`).emit('voice-state-update', eventData);
      } else if (session.type === 'dm') {
        // Notify all participants in DM call
        session.participants.forEach(participantId => {
          if (participantId.toString() !== decoded.userId) {
            io.to(`user:${participantId}`).emit('dm-call-state-update', eventData);
          }
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Voice state updated successfully',
      state: updates
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Update voice session error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update voice session'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// DELETE - Leave voice session
export async function DELETE(request, { params }) {
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

    // Check if user is in the session
    const userInSession = session.activeUsers.find(u => u.user._id.toString() === decoded.userId);
    if (!userInSession) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You are not in this voice session'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Remove user from session
    await session.removeUser(decoded.userId);

    // Get Socket.io instance and notify other users
    const io = getIO();
    if (io) {
      const eventData = {
        sessionId: session.sessionId,
        userId: decoded.userId,
        username: userInSession.user.username,
        timestamp: new Date()
      };

      if (session.type === 'channel') {
        io.to(`server:${session.server}`).emit('voice-user-left', eventData);
      } else if (session.type === 'dm') {
        // Notify all participants in DM call
        session.participants.forEach(participantId => {
          if (participantId.toString() !== decoded.userId) {
            io.to(`user:${participantId}`).emit('dm-call-ended', eventData);
          }
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Left voice session successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Leave voice session error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to leave voice session'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
