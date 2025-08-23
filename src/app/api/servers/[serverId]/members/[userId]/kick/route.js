const Server = require('../../../../../../../models/Server');
const User = require('../../../../../../../models/User');
const { verifyToken, extractTokenFromHeader } = require('../../../../../../../lib/jwt');
const connectDB = require('../../../../../../../lib/mongodb');
const { getIO } = require('../../../../../../../socket');

// POST - Kick a member from the server
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
    const { reason } = await request.json().catch(() => ({}));

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

    // Check if the target user is a member of the server
    const targetMember = server.members.find(m => m.user._id.toString() === userId);
    if (!targetMember) {
      return Response.json(
        { success: false, error: 'User is not a member of this server' },
        { status: 404 }
      );
    }

    // Prevent self-kick
    if (decoded.userId === userId) {
      return Response.json(
        { success: false, error: 'You cannot kick yourself' },
        { status: 400 }
      );
    }

    // Prevent kicking the server owner
    if (server.owner.toString() === userId) {
      return Response.json(
        { success: false, error: 'Cannot kick the server owner' },
        { status: 400 }
      );
    }

    // Check permissions - user must be owner or have KICK_MEMBERS permission
    const isOwner = server.owner.toString() === decoded.userId;
    let hasKickPermission = false;

    if (!isOwner) {
      // Check if user has KICK_MEMBERS permission through roles
      const userRoles = server.roles.filter(role => 
        requestingMember.roles.some(roleId => roleId.toString() === role._id.toString())
      );
      
      hasKickPermission = userRoles.some(role => 
        role.permissions && (
          role.permissions.includes('KICK_MEMBERS') || role.permissions.includes('ADMINISTRATOR')
        )
      );
    }

    if (!isOwner && !hasKickPermission) {
      return Response.json(
        { success: false, error: 'Insufficient permissions - You need KICK_MEMBERS permission' },
        { status: 403 }
      );
    }

    // Check role hierarchy - cannot kick someone with equal or higher role
    if (!isOwner) {
      const requestingUserHighestRole = getHighestRolePosition(requestingMember.roles, server.roles);
      const targetUserHighestRole = getHighestRolePosition(targetMember.roles, server.roles);
      
      if (targetUserHighestRole >= requestingUserHighestRole) {
        return Response.json(
          { success: false, error: 'Cannot kick a user with equal or higher role' },
          { status: 403 }
        );
      }
    }

    // Remove the user from the server
    server.members = server.members.filter(m => m.user._id.toString() !== userId);
    await server.save();

    // Remove the server from the user's servers list
    await User.findByIdAndUpdate(userId, {
      $pull: { servers: serverId }
    });

    // Emit real-time kick notifications
    try {
      const io = getIO();
      if (io) {
        // Notify the kicked user
        io.to(`user:${userId}`).emit('kicked-from-server', {
          server: {
            id: server._id,
            name: server.name,
            icon: server.icon
          },
          kickedBy: {
            id: decoded.userId,
            username: requestingMember.user.username
          },
          reason: reason || 'No reason provided',
          message: `You have been kicked from ${server.name}`,
          timestamp: new Date()
        });

        // Notify all server members about the kick
        io.to(`server:${serverId}`).emit('member-kicked', {
          member: {
            id: targetMember.user._id,
            username: targetMember.user.username,
            avatar: targetMember.user.avatar
          },
          kickedBy: {
            id: decoded.userId,
            username: requestingMember.user.username
          },
          reason: reason || 'No reason provided',
          server: {
            id: server._id,
            name: server.name
          },
          message: `${targetMember.user.username} was kicked from the server`,
          timestamp: new Date()
        });

        console.log(`✅ Kick notifications sent for user:${userId} from server:${serverId}`);
      } else {
        console.log(`⚠️ Socket.io not initialized, kick notifications not sent`);
      }
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
    }

    // Create audit log entry (for future implementation)
    const auditLog = {
      action: 'MEMBER_KICK',
      executor: decoded.userId,
      target: userId,
      reason: reason || 'No reason provided',
      timestamp: new Date()
    };

    return Response.json({
      success: true,
      message: 'Member kicked successfully',
      kickedUser: {
        id: targetMember.user._id,
        username: targetMember.user.username,
        avatar: targetMember.user.avatar
      },
      reason: reason || 'No reason provided',
      auditLog
    });

  } catch (error) {
    console.error('Kick member error:', error);
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
