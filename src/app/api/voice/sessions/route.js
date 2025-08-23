const VoiceSession = require('../../../../models/VoiceSession');
const Channel = require('../../../../models/Channel');
const Server = require('../../../../models/Server');
const User = require('../../../../models/User');
const { verifyToken, extractTokenFromHeader } = require('../../../../lib/jwt');
const connectDB = require('../../../../lib/mongodb');
const { getIO } = require('../../../../socket');

// GET - Get active voice sessions
export async function GET(request) {
  try {
    await connectDB();
    
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
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

    // Get user's active voice sessions
    const sessions = await VoiceSession.find({
      isActive: true,
      $or: [
        { 'activeUsers.user': decoded.userId },
        { participants: decoded.userId }
      ]
    })
    .populate('channel', 'name type')
    .populate('server', 'name')
    .populate('activeUsers.user', 'username avatar status')
    .populate('participants', 'username avatar status');

    return new Response(JSON.stringify({
      success: true,
      sessions: sessions
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get voice sessions error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get voice sessions'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST - Create or join a voice session
export async function POST(request) {
  try {
    await connectDB();
    
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
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
    const { type, channelId, participantId, peerId, socketId } = body;

    // Validate input
    if (!type || !peerId || !socketId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Type, peerId, and socketId are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let session;

    if (type === 'channel') {
      if (!channelId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Channel ID is required for channel voice sessions'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if channel exists and is a voice channel
      const channel = await Channel.findById(channelId).populate('server');
      if (!channel) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Channel not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (channel.type !== 'voice') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Channel is not a voice channel'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if user has permission to join the channel
      const server = await Server.findById(channel.server._id);
      const isMember = server.members.some(member => member.user.toString() === decoded.userId);
      
      if (!isMember) {
        return new Response(JSON.stringify({
          success: false,
          error: 'You are not a member of this server'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Find or create voice session for this channel
      session = await VoiceSession.findOne({
        channel: channelId,
        isActive: true
      });

      if (!session) {
        session = new VoiceSession({
          sessionId: `channel_${channelId}_${Date.now()}`,
          type: 'channel',
          channel: channelId,
          server: channel.server._id,
          createdBy: decoded.userId,
          activeUsers: []
        });
      }

    } else if (type === 'dm') {
      if (!participantId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Participant ID is required for DM voice sessions'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if participant exists
      const participant = await User.findById(participantId);
      if (!participant) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Participant not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Find or create DM voice session
      session = await VoiceSession.findOne({
        type: 'dm',
        participants: { $all: [decoded.userId, participantId] },
        isActive: true
      });

      if (!session) {
        session = new VoiceSession({
          sessionId: `dm_${decoded.userId}_${participantId}_${Date.now()}`,
          type: 'dm',
          participants: [decoded.userId, participantId],
          createdBy: decoded.userId,
          activeUsers: []
        });
      }
    }

    // Add user to session
    await session.addUser(decoded.userId, socketId, peerId);
    await session.populate('activeUsers.user', 'username avatar status');

    // Get Socket.io instance and notify other users
    const io = getIO();
    if (io) {
      if (type === 'channel') {
        // Notify all users in the server about voice channel join
        io.to(`server:${session.server}`).emit('voice-user-joined', {
          sessionId: session.sessionId,
          channelId: session.channel,
          user: {
            id: decoded.userId,
            username: session.activeUsers.find(u => u.user._id.toString() === decoded.userId).user.username,
            avatar: session.activeUsers.find(u => u.user._id.toString() === decoded.userId).user.avatar
          },
          timestamp: new Date()
        });
      } else if (type === 'dm') {
        // Notify the other participant about DM call
        const otherParticipant = session.participants.find(p => p.toString() !== decoded.userId);
        io.to(`user:${otherParticipant}`).emit('dm-call-incoming', {
          sessionId: session.sessionId,
          caller: {
            id: decoded.userId,
            username: session.activeUsers.find(u => u.user._id.toString() === decoded.userId).user.username,
            avatar: session.activeUsers.find(u => u.user._id.toString() === decoded.userId).user.avatar
          },
          timestamp: new Date()
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      session: {
        id: session._id,
        sessionId: session.sessionId,
        type: session.type,
        activeUsers: session.activeUsers,
        participants: session.participants
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Create/join voice session error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create/join voice session'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
