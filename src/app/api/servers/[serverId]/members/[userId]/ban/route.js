const Server = require('../../../../../../../models/Server');
const User = require('../../../../../../../models/User');
const { verifyToken, extractTokenFromHeader } = require('../../../../../../../lib/jwt');
const connectDB = require('../../../../../../../lib/mongodb');

// POST - Ban a member from the server
export async function POST(request, { params }) {
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

    const { serverId, userId } = await params;
    const { reason, deleteMessageDays = 0 } = await request.json().catch(() => ({}));

    // Find the server
    const server = await Server.findById(serverId)
      .populate('members.user', 'username avatar')
      .populate('roles');

    if (!server) {
      return Response.json(
        { success: false, error: 'Server not found' },
        { status: 404 }
      );
    }

    // Check if the requesting user is a member of the server
    const requestingMember = server.members.find(m => m.user._id.toString() === decoded.userId);
    if (!requestingMember) {
      return Response.json(
        { success: false, error: 'You are not a member of this server' },
        { status: 403 }
      );
    }

    // Find the target user (might not be a member anymore)
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent self-ban
    if (decoded.userId === userId) {
      return Response.json(
        { success: false, error: 'You cannot ban yourself' },
        { status: 400 }
      );
    }

    // Prevent banning the server owner
    if (server.owner.toString() === userId) {
      return Response.json(
        { success: false, error: 'Cannot ban the server owner' },
        { status: 400 }
      );
    }

    // Check if user is already banned
    const isAlreadyBanned = server.bannedUsers && server.bannedUsers.some(ban => ban.user.toString() === userId);
    if (isAlreadyBanned) {
      return Response.json(
        { success: false, error: 'User is already banned from this server' },
        { status: 400 }
      );
    }

    // Check permissions - user must be owner or have BAN_MEMBERS permission
    const isOwner = server.owner.toString() === decoded.userId;
    let hasBanPermission = false;

    if (!isOwner) {
      // Check if user has BAN_MEMBERS permission through roles
      const userRoles = server.roles.filter(role => 
        requestingMember.roles.some(roleId => roleId.toString() === role._id.toString())
      );
      
      hasBanPermission = userRoles.some(role => 
        role.permissions && (
          role.permissions.includes('BAN_MEMBERS') || role.permissions.includes('ADMINISTRATOR')
        )
      );
    }

    if (!isOwner && !hasBanPermission) {
      return Response.json(
        { success: false, error: 'Insufficient permissions - You need BAN_MEMBERS permission' },
        { status: 403 }
      );
    }

    // Check role hierarchy if user is still a member
    const targetMember = server.members.find(m => m.user._id.toString() === userId);
    if (targetMember && !isOwner) {
      const requestingUserHighestRole = getHighestRolePosition(requestingMember.roles, server.roles);
      const targetUserHighestRole = getHighestRolePosition(targetMember.roles, server.roles);
      
      if (targetUserHighestRole >= requestingUserHighestRole) {
        return Response.json(
          { success: false, error: 'Cannot ban a user with equal or higher role' },
          { status: 403 }
        );
      }
    }

    // Initialize bannedUsers array if it doesn't exist
    if (!server.bannedUsers) {
      server.bannedUsers = [];
    }

    // Add user to banned list
    server.bannedUsers.push({
      user: userId,
      bannedBy: decoded.userId,
      reason: reason || 'No reason provided',
      bannedAt: new Date()
    });

    // Remove the user from the server if they're a member
    if (targetMember) {
      server.members = server.members.filter(m => m.user._id.toString() !== userId);
      
      // Remove the server from the user's servers list
      await User.findByIdAndUpdate(userId, {
        $pull: { servers: serverId }
      });
    }

    await server.save();

    // TODO: Delete messages if deleteMessageDays > 0
    // This would require implementing message deletion based on time range

    // Create audit log entry
    const auditLog = {
      action: 'MEMBER_BAN',
      executor: decoded.userId,
      target: userId,
      reason: reason || 'No reason provided',
      deleteMessageDays,
      timestamp: new Date()
    };

    return Response.json({
      success: true,
      message: 'Member banned successfully',
      bannedUser: {
        id: targetUser._id,
        username: targetUser.username,
        avatar: targetUser.avatar
      },
      reason: reason || 'No reason provided',
      deleteMessageDays,
      auditLog
    });

  } catch (error) {
    console.error('Ban member error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to get the highest role position
function getHighestRolePosition(userRoles, serverRoles) {
  if (!userRoles.length) return 0;
  
  const positions = userRoles.map(roleId => {
    const role = serverRoles.find(r => r._id.toString() === roleId.toString());
    return role ? role.position : 0;
  });
  
  return Math.max(...positions);
}
