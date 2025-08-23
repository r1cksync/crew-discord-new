const Server = require('../../../../../../../models/Server');
const { verifyToken, extractTokenFromHeader } = require('../../../../../../../lib/jwt');
const connectDB = require('../../../../../../../lib/mongodb');
const { getIO } = require('../../../../../../../socket');

// POST - Timeout/mute a member temporarily
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
    const { duration, reason } = await request.json().catch(() => ({}));

    // Validate duration (in minutes)
    if (!duration || duration < 1 || duration > 40320) { // Max 28 days
      return Response.json(
        { success: false, error: 'Duration must be between 1 minute and 28 days (40320 minutes)' },
        { status: 400 }
      );
    }

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

    // Prevent self-timeout
    if (decoded.userId === userId) {
      return Response.json(
        { success: false, error: 'You cannot timeout yourself' },
        { status: 400 }
      );
    }

    // Prevent timing out the server owner
    if (server.owner.toString() === userId) {
      return Response.json(
        { success: false, error: 'Cannot timeout the server owner' },
        { status: 400 }
      );
    }

    // Check permissions - user must be owner or have MUTE_MEMBERS permission
    const isOwner = server.owner.toString() === decoded.userId;
    let hasMutePermission = false;

    if (!isOwner) {
      // Check if user has MUTE_MEMBERS permission through roles
      const userRoles = server.roles.filter(role => 
        requestingMember.roles.some(roleId => roleId.toString() === role._id.toString())
      );
      
      hasMutePermission = userRoles.some(role => 
        role.permissions && (
          role.permissions.includes('MUTE_MEMBERS') || role.permissions.includes('ADMINISTRATOR')
        )
      );
    }

    if (!isOwner && !hasMutePermission) {
      return Response.json(
        { success: false, error: 'Insufficient permissions - You need MUTE_MEMBERS permission' },
        { status: 403 }
      );
    }

    // Check role hierarchy
    if (!isOwner) {
      const requestingUserHighestRole = getHighestRolePosition(requestingMember.roles, server.roles);
      const targetUserHighestRole = getHighestRolePosition(targetMember.roles, server.roles);
      
      if (targetUserHighestRole >= requestingUserHighestRole) {
        return Response.json(
          { success: false, error: 'Cannot timeout a user with equal or higher role' },
          { status: 403 }
        );
      }
    }

    // Calculate timeout end time
    const timeoutUntil = new Date(Date.now() + (duration * 60 * 1000));

    // Initialize timeouts array if it doesn't exist
    if (!server.timeouts) {
      server.timeouts = [];
    }

    // Remove any existing timeout for this user
    server.timeouts = server.timeouts.filter(timeout => timeout.user.toString() !== userId);

    // Add new timeout
    server.timeouts.push({
      user: userId,
      timeoutBy: decoded.userId,
      reason: reason || 'No reason provided',
      timeoutUntil,
      timeoutAt: new Date()
    });

    await server.save();

    // Emit real-time timeout notification
    try {
      const io = getIO();
      if (io) {
        // Notify the timed out user
        io.to(`user:${userId}`).emit('timeout-applied', {
          timeout: {
            duration: duration,
            timeoutUntil: timeoutUntil,
            reason: reason || 'No reason provided'
          },
          server: {
            id: server._id,
            name: server.name,
            icon: server.icon
          },
          timeoutBy: {
            id: decoded.userId,
            username: requestingMember.user.username
          },
          message: `You have been timed out in ${server.name} for ${duration} minutes`,
          timestamp: new Date()
        });

        // Notify server moderators about the timeout
        io.to(`server:${serverId}`).emit('member-timeout', {
          member: {
            id: targetMember.user._id,
            username: targetMember.user.username,
            avatar: targetMember.user.avatar
          },
          timeout: {
            duration: duration,
            timeoutUntil: timeoutUntil,
            reason: reason || 'No reason provided'
          },
          timeoutBy: {
            id: decoded.userId,
            username: requestingMember.user.username
          },
          server: {
            id: server._id,
            name: server.name
          },
          timestamp: new Date()
        });

        console.log(`✅ Timeout notifications sent for user:${userId} in server:${serverId}`);
      } else {
        console.log(`⚠️ Socket.io not initialized, timeout notifications not sent`);
      }
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
    }

    // Create audit log entry
    const auditLog = {
      action: 'MEMBER_TIMEOUT',
      executor: decoded.userId,
      target: userId,
      reason: reason || 'No reason provided',
      duration: `${duration} minutes`,
      timeoutUntil,
      timestamp: new Date()
    };

    return Response.json({
      success: true,
      message: 'Member timed out successfully',
      targetUser: {
        id: targetMember.user._id,
        username: targetMember.user.username,
        avatar: targetMember.user.avatar
      },
      reason: reason || 'No reason provided',
      duration: `${duration} minutes`,
      timeoutUntil,
      auditLog
    });

  } catch (error) {
    console.error('Timeout member error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove timeout from a member
export async function DELETE(request, { params }) {
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

    // Check permissions
    const requestingMember = server.members.find(m => m.user._id.toString() === decoded.userId);
    if (!requestingMember) {
      return Response.json(
        { success: false, error: 'You are not a member of this server' },
        { status: 403 }
      );
    }

    const isOwner = server.owner.toString() === decoded.userId;
    let hasMutePermission = false;

    if (!isOwner) {
      const userRoles = server.roles.filter(role => 
        requestingMember.roles.some(roleId => roleId.toString() === role._id.toString())
      );
      
      hasMutePermission = userRoles.some(role => 
        role.permissions && (
          role.permissions.includes('MUTE_MEMBERS') || role.permissions.includes('ADMINISTRATOR')
        )
      );
    }

    if (!isOwner && !hasMutePermission) {
      return Response.json(
        { success: false, error: 'Insufficient permissions - You need MUTE_MEMBERS permission' },
        { status: 403 }
      );
    }

    // Remove timeout
    const originalLength = server.timeouts ? server.timeouts.length : 0;
    server.timeouts = server.timeouts ? server.timeouts.filter(timeout => timeout.user.toString() !== userId) : [];
    
    if (server.timeouts.length === originalLength) {
      return Response.json(
        { success: false, error: 'User is not currently timed out' },
        { status: 400 }
      );
    }

    await server.save();

    return Response.json({
      success: true,
      message: 'Timeout removed successfully'
    });

  } catch (error) {
    console.error('Remove timeout error:', error);
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
