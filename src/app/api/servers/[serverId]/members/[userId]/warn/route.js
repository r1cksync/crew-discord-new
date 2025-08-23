const Server = require('../../../../../../../models/Server');
const { verifyToken, extractTokenFromHeader } = require('../../../../../../../lib/jwt');
const connectDB = require('../../../../../../../lib/mongodb');
const { getIO } = require('../../../../../../../socket');

// POST - Issue a warning to a member
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

    if (!reason || reason.trim().length === 0) {
      return Response.json(
        { success: false, error: 'Warning reason is required' },
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

    // Prevent self-warning
    if (decoded.userId === userId) {
      return Response.json(
        { success: false, error: 'You cannot warn yourself' },
        { status: 400 }
      );
    }

    // Prevent warning the server owner
    if (server.owner.toString() === userId) {
      return Response.json(
        { success: false, error: 'Cannot warn the server owner' },
        { status: 400 }
      );
    }

    // Check permissions - user must be owner or have MANAGE_MESSAGES permission
    const isOwner = server.owner.toString() === decoded.userId;
    let hasWarnPermission = false;

    if (!isOwner) {
      // Check if user has MANAGE_MESSAGES permission through roles
      const userRoles = server.roles.filter(role => 
        requestingMember.roles.some(roleId => roleId.toString() === role._id.toString())
      );
      
      hasWarnPermission = userRoles.some(role => 
        role.permissions && (
          role.permissions.includes('MANAGE_MESSAGES') || 
          role.permissions.includes('KICK_MEMBERS') ||
          role.permissions.includes('ADMINISTRATOR')
        )
      );
    }

    if (!isOwner && !hasWarnPermission) {
      return Response.json(
        { success: false, error: 'Insufficient permissions - You need MANAGE_MESSAGES permission' },
        { status: 403 }
      );
    }

    // Check role hierarchy
    if (!isOwner) {
      const requestingUserHighestRole = getHighestRolePosition(requestingMember.roles, server.roles);
      const targetUserHighestRole = getHighestRolePosition(targetMember.roles, server.roles);
      
      if (targetUserHighestRole >= requestingUserHighestRole) {
        return Response.json(
          { success: false, error: 'Cannot warn a user with equal or higher role' },
          { status: 403 }
        );
      }
    }

    // Initialize warnings array if it doesn't exist
    if (!server.warnings) {
      server.warnings = [];
    }

    // Create warning object
    const warning = {
      id: new Date().getTime().toString(), // Simple ID generation
      user: userId,
      warnedBy: decoded.userId,
      reason: reason.trim(),
      warnedAt: new Date()
    };

    // Add warning
    server.warnings.push(warning);
    await server.save();

    // Get warning count for this user
    const userWarnings = server.warnings.filter(w => w.user.toString() === userId);

    // Emit real-time warning notification
    try {
      const io = getIO();
      if (io) {
        // Notify the warned user
        io.to(`user:${userId}`).emit('warning-received', {
          warning: {
            id: warning.id,
            reason: reason.trim(),
            warnedAt: warning.warnedAt,
            warningCount: userWarnings.length
          },
          server: {
            id: server._id,
            name: server.name,
            icon: server.icon
          },
          warnedBy: {
            id: decoded.userId,
            username: requestingMember.user.username
          },
          message: `You received a warning in ${server.name}`,
          timestamp: new Date()
        });

        // Optionally notify moderators about the warning (if they have permission)
        io.to(`server:${serverId}`).emit('member-warned', {
          member: {
            id: targetMember.user._id,
            username: targetMember.user.username,
            avatar: targetMember.user.avatar
          },
          warning: {
            id: warning.id,
            reason: reason.trim(),
            warningCount: userWarnings.length
          },
          warnedBy: {
            id: decoded.userId,
            username: requestingMember.user.username
          },
          server: {
            id: server._id,
            name: server.name
          },
          timestamp: new Date()
        });

        console.log(`✅ Warning notifications sent for user:${userId} in server:${serverId}`);
      } else {
        console.log(`⚠️ Socket.io not initialized, warning notifications not sent`);
      }
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
    }

    // Create audit log entry
    const auditLog = {
      action: 'MEMBER_WARN',
      executor: decoded.userId,
      target: userId,
      reason: reason.trim(),
      warningCount: userWarnings.length,
      timestamp: new Date()
    };

    return Response.json({
      success: true,
      message: 'Warning issued successfully',
      warning: {
        id: warning.id,
        targetUser: {
          id: targetMember.user._id,
          username: targetMember.user.username,
          avatar: targetMember.user.avatar
        },
        reason: reason.trim(),
        warnedAt: warning.warnedAt,
        warningCount: userWarnings.length
      },
      auditLog
    });

  } catch (error) {
    console.error('Warn member error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get warnings for a user
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

    const { serverId, userId } = await params;

    // Find the server
    const server = await Server.findById(serverId)
      .populate('members.user', 'username avatar')
      .populate('roles')
      .populate('warnings.warnedBy', 'username avatar');

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
    let hasViewPermission = false;

    if (!isOwner) {
      const userRoles = server.roles.filter(role => 
        requestingMember.roles.some(roleId => roleId.toString() === role._id.toString())
      );
      
      hasViewPermission = userRoles.some(role => 
        role.permissions && (
          role.permissions.includes('MANAGE_MESSAGES') || 
          role.permissions.includes('KICK_MEMBERS') ||
          role.permissions.includes('ADMINISTRATOR')
        )
      );
    }

    // Users can view their own warnings
    const canViewOwnWarnings = decoded.userId === userId;

    if (!isOwner && !hasViewPermission && !canViewOwnWarnings) {
      return Response.json(
        { success: false, error: 'Insufficient permissions to view warnings' },
        { status: 403 }
      );
    }

    // Get warnings for the user
    const userWarnings = server.warnings ? server.warnings.filter(w => w.user.toString() === userId) : [];

    return Response.json({
      success: true,
      warnings: userWarnings.map(warning => ({
        id: warning.id,
        reason: warning.reason,
        warnedBy: warning.warnedBy ? {
          id: warning.warnedBy._id,
          username: warning.warnedBy.username,
          avatar: warning.warnedBy.avatar
        } : null,
        warnedAt: warning.warnedAt
      })),
      totalWarnings: userWarnings.length
    });

  } catch (error) {
    console.error('Get warnings error:', error);
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
