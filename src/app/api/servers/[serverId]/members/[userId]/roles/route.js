const Server = require('../../../../../../../models/Server');
const { verifyToken, extractTokenFromHeader } = require('../../../../../../../lib/jwt');
const connectDB = require('../../../../../../../lib/mongodb');

// PUT - Assign or remove roles from a member
export async function PUT(request, { params }) {
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
    const { roleIds, action } = await request.json().catch(() => ({}));

    // Validate action
    if (!action || !['add', 'remove', 'set'].includes(action)) {
      return Response.json(
        { success: false, error: 'Action must be "add", "remove", or "set"' },
        { status: 400 }
      );
    }

    // Validate roleIds
    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      return Response.json(
        { success: false, error: 'Role IDs must be a non-empty array' },
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
    const targetMemberIndex = server.members.findIndex(m => m.user._id.toString() === userId);
    if (targetMemberIndex === -1) {
      return Response.json(
        { success: false, error: 'User is not a member of this server' },
        { status: 404 }
      );
    }

    // Prevent modifying server owner's roles (unless self-modification)
    if (server.owner.toString() === userId && decoded.userId !== userId) {
      return Response.json(
        { success: false, error: 'Cannot modify server owner roles' },
        { status: 400 }
      );
    }

    // Check permissions - user must be owner or have MANAGE_ROLES permission
    const isOwner = server.owner.toString() === decoded.userId;
    let hasManageRolesPermission = false;

    if (!isOwner) {
      // Check if user has MANAGE_ROLES permission through roles
      const userRoles = server.roles.filter(role => 
        requestingMember.roles.some(roleId => roleId.toString() === role._id.toString())
      );
      
      hasManageRolesPermission = userRoles.some(role => 
        role.permissions && (
          role.permissions.includes('MANAGE_ROLES') || role.permissions.includes('ADMINISTRATOR')
        )
      );
    }

    if (!isOwner && !hasManageRolesPermission) {
      return Response.json(
        { success: false, error: 'Insufficient permissions - You need MANAGE_ROLES permission' },
        { status: 403 }
      );
    }

    // Validate that all role IDs exist in the server
    const serverRoleIds = server.roles.map(role => role._id.toString());
    const invalidRoles = roleIds.filter(roleId => !serverRoleIds.includes(roleId));
    
    if (invalidRoles.length > 0) {
      return Response.json(
        { success: false, error: `Invalid role IDs: ${invalidRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Check role hierarchy - cannot assign roles equal to or higher than your highest role
    if (!isOwner) {
      const requestingUserHighestRole = getHighestRolePosition(requestingMember.roles, server.roles);
      const rolesToAssign = server.roles.filter(role => roleIds.includes(role._id.toString()));
      
      const hasHigherRoles = rolesToAssign.some(role => role.position >= requestingUserHighestRole);
      if (hasHigherRoles) {
        return Response.json(
          { success: false, error: 'Cannot assign roles equal to or higher than your highest role' },
          { status: 403 }
        );
      }
    }

    // Prevent assigning/removing @everyone role
    const everyoneRole = server.roles.find(role => role.isDefault);
    if (everyoneRole && roleIds.includes(everyoneRole._id.toString())) {
      return Response.json(
        { success: false, error: 'Cannot modify @everyone role assignment' },
        { status: 400 }
      );
    }

    // Get current target member
    const targetMember = server.members[targetMemberIndex];
    let currentRoles = targetMember.roles.map(roleId => roleId.toString());

    // Apply role changes based on action
    let newRoles;
    switch (action) {
      case 'add':
        newRoles = [...new Set([...currentRoles, ...roleIds])];
        break;
      case 'remove':
        newRoles = currentRoles.filter(roleId => !roleIds.includes(roleId));
        break;
      case 'set':
        // Keep @everyone role and add new roles
        const everyoneRoleId = everyoneRole ? everyoneRole._id.toString() : null;
        newRoles = everyoneRoleId ? [everyoneRoleId, ...roleIds.filter(id => id !== everyoneRoleId)] : roleIds;
        break;
    }

    // Update the member's roles
    server.members[targetMemberIndex].roles = newRoles;
    await server.save();

    // Get role details for response
    const assignedRoleDetails = server.roles
      .filter(role => newRoles.includes(role._id.toString()))
      .map(role => ({
        id: role._id,
        name: role.name,
        color: role.color,
        position: role.position,
        permissions: role.permissions
      }));

    // Create audit log entry
    const auditLog = {
      action: 'MEMBER_ROLE_UPDATE',
      executor: decoded.userId,
      target: userId,
      action_type: action,
      roles: roleIds,
      timestamp: new Date()
    };

    return Response.json({
      success: true,
      message: `Roles ${action}ed successfully`,
      targetUser: {
        id: targetMember.user._id,
        username: targetMember.user.username,
        avatar: targetMember.user.avatar
      },
      action,
      modifiedRoles: roleIds,
      currentRoles: assignedRoleDetails,
      auditLog
    });

  } catch (error) {
    console.error('Modify member roles error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get member's current roles
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
      .populate('roles');

    if (!server) {
      return Response.json(
        { success: false, error: 'Server not found' },
        { status: 404 }
      );
    }

    // Check if requesting user is a member
    const requestingMember = server.members.find(m => m.user._id.toString() === decoded.userId);
    if (!requestingMember) {
      return Response.json(
        { success: false, error: 'You are not a member of this server' },
        { status: 403 }
      );
    }

    // Find target member
    const targetMember = server.members.find(m => m.user._id.toString() === userId);
    if (!targetMember) {
      return Response.json(
        { success: false, error: 'User is not a member of this server' },
        { status: 404 }
      );
    }

    // Get role details
    const memberRoles = server.roles
      .filter(role => targetMember.roles.some(roleId => roleId.toString() === role._id.toString()))
      .map(role => ({
        id: role._id,
        name: role.name,
        color: role.color,
        position: role.position,
        permissions: role.permissions,
        mentionable: role.mentionable,
        isDefault: role.isDefault
      }))
      .sort((a, b) => b.position - a.position); // Sort by position (highest first)

    return Response.json({
      success: true,
      user: {
        id: targetMember.user._id,
        username: targetMember.user.username,
        avatar: targetMember.user.avatar
      },
      roles: memberRoles,
      highestRole: memberRoles.length > 0 ? memberRoles[0] : null
    });

  } catch (error) {
    console.error('Get member roles error:', error);
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
