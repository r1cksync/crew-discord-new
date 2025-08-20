const Server = require('../../../../../models/Server');
const User = require('../../../../../models/User');
const { verifyToken, extractTokenFromHeader } = require('../../../../../lib/jwt');
const connectDB = require('../../../../../lib/mongodb');

// GET - Get invite statistics and management info for a server
export async function GET(request, { params }) {
  try {
    await connectDB();
    
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return Response.json(
        { success: false, error: 'Access token is required' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return Response.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { serverId } = await params;

    const server = await Server.findById(serverId)
      .populate('members.user', 'username avatar joinedAt')
      .populate('owner', 'username avatar');

    if (!server) {
      return Response.json(
        { success: false, error: 'Server not found' },
        { status: 404 }
      );
    }

    // Check if user is a member of the server
    const member = server.members.find(m => m.user._id.toString() === decoded.userId);
    const isOwner = server.owner._id.toString() === decoded.userId;

    if (!member && !isOwner) {
      return Response.json(
        { success: false, error: 'Access denied - You must be a member of this server' },
        { status: 403 }
      );
    }

    // Calculate member join statistics
    const memberJoinDates = server.members.map(m => m.joinedAt).sort((a, b) => new Date(b) - new Date(a));
    const recentJoins = memberJoinDates.filter(date => {
      const daysDiff = (new Date() - new Date(date)) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7; // Joined in last 7 days
    });

    // Get recent members (last 10 who joined)
    const recentMembers = server.members
      .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt))
      .slice(0, 10)
      .map(member => ({
        id: member.user._id,
        username: member.user.username,
        avatar: member.user.avatar,
        joinedAt: member.joinedAt
      }));

    return Response.json({
      success: true,
      inviteInfo: {
        code: server.inviteCode,
        url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${server.inviteCode}`,
        serverName: server.name,
        serverIcon: server.icon,
        isPublic: server.isPublic
      },
      statistics: {
        totalMembers: server.members.length,
        recentJoins: recentJoins.length,
        createdAt: server.createdAt,
        owner: {
          id: server.owner._id,
          username: server.owner.username,
          avatar: server.owner.avatar
        }
      },
      recentMembers,
      permissions: {
        canRegenerateInvite: isOwner,
        canViewStatistics: true,
        isOwner
      }
    });

  } catch (error) {
    console.error('Get invites info error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
