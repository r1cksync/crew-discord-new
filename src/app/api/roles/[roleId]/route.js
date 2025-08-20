const Role = require('../../../../models/Role');
const Server = require('../../../../models/Server');
const { verifyToken, extractTokenFromHeader } = require('../../../../lib/jwt');
const connectDB = require('../../../../lib/mongodb');

// GET - Get role details
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

    const { roleId } = await params;

    // Find the role
    const role = await Role.findById(roleId).populate('server');

    if (!role) {
      return Response.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      );
    }

    // Check if user is a member of the server
    const server = await Server.findById(role.server._id)
      .populate('members.user', 'username avatar');

    const member = server.members.find(m => m.user._id.toString() === decoded.userId);
    if (!member) {
      return Response.json(
        { success: false, error: 'You are not a member of this server' },
        { status: 403 }
      );
    }

    // Get member count for this role
    const memberCount = server.members.filter(member => 
      member.roles.some(roleId => roleId.toString() === role._id.toString())
    ).length;

    return Response.json({
      success: true,
      role: {
        id: role._id,
        name: role.name,
        color: role.color,
        position: role.position,
        permissions: role.permissions,
        mentionable: role.mentionable,
        isDefault: role.isDefault,
        memberCount,
        server: {
          id: role.server._id,
          name: role.server.name
        },
        createdAt: role.createdAt,
        updatedAt: role.updatedAt
      }
    });

  } catch (error) {
    console.error('Get role error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update role
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

    const { roleId } = await params;
    const { name, color, permissions, mentionable, position } = await request.json().catch(() => ({}));

    // Find the role
    const role = await Role.findById(roleId).populate('server');

    if (!role) {
      return Response.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      );
    }

    // Prevent editing @everyone role permissions
    if (role.isDefault && permissions) {
      return Response.json(
        { success: false, error: 'Cannot modify @everyone role permissions' },
        { status: 400 }
      );
    }

    // Find the server and check permissions
    const server = await Server.findById(role.server._id)
      .populate('members.user', 'username avatar')
      .populate('roles');

    const member = server.members.find(m => m.user._id.toString() === decoded.userId);
    if (!member) {
      return Response.json(
        { success: false, error: 'You are not a member of this server' },
        { status: 403 }
      );
    }

    const isOwner = server.owner.toString() === decoded.userId;
    let hasManageRolesPermission = false;

    if (!isOwner) {
      const userRoles = server.roles.filter(serverRole => 
        member.roles.some(roleId => roleId.toString() === serverRole._id.toString())
      );
      
      hasManageRolesPermission = userRoles.some(userRole => 
        userRole.permissions && (
          userRole.permissions.includes('MANAGE_ROLES') || userRole.permissions.includes('ADMINISTRATOR')
        )
      );
    }

    if (!isOwner && !hasManageRolesPermission) {
      return Response.json(
        { success: false, error: 'Insufficient permissions - You need MANAGE_ROLES permission' },
        { status: 403 }
      );
    }

    // Check role hierarchy - cannot edit roles equal to or higher than your highest role
    if (!isOwner) {
      const userHighestRole = getHighestRolePosition(member.roles, server.roles);
      
      if (role.position >= userHighestRole) {
        return Response.json(
          { success: false, error: 'Cannot edit a role equal to or higher than your highest role' },
          { status: 403 }
        );
      }
    }

    // Validate name if provided
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return Response.json(
          { success: false, error: 'Role name cannot be empty' },
          { status: 400 }
        );
      }

      if (name.trim().length > 100) {
        return Response.json(
          { success: false, error: 'Role name must be 100 characters or less' },
          { status: 400 }
        );
      }

      // Check for duplicate name (excluding current role)
      const existingRole = server.roles.find(serverRole => 
        serverRole._id.toString() !== roleId &&
        serverRole.name.toLowerCase() === name.trim().toLowerCase()
      );
      
      if (existingRole) {
        return Response.json(
          { success: false, error: 'A role with this name already exists' },
          { status: 400 }
        );
      }
    }

    // Validate permissions if provided
    if (permissions) {
      const validPermissions = [
        'ADMINISTRATOR',
        'MANAGE_CHANNELS',
        'MANAGE_ROLES',
        'MANAGE_MESSAGES',
        'KICK_MEMBERS',
        'BAN_MEMBERS',
        'SEND_MESSAGES',
        'READ_MESSAGES',
        'CONNECT',
        'SPEAK',
        'MUTE_MEMBERS',
        'DEAFEN_MEMBERS',
        'MOVE_MEMBERS'
      ];

      const invalidPermissions = permissions.filter(perm => !validPermissions.includes(perm));
      
      if (invalidPermissions.length > 0) {
        return Response.json(
          { success: false, error: `Invalid permissions: ${invalidPermissions.join(', ')}` },
          { status: 400 }
        );
      }

      // Check if user can assign these permissions
      if (!isOwner) {
        const userPermissions = getUserPermissions(member.roles, server.roles);
        const unauthorizedPermissions = permissions.filter(perm => 
          !userPermissions.includes(perm) && !userPermissions.includes('ADMINISTRATOR')
        );
        
        if (unauthorizedPermissions.length > 0) {
          return Response.json(
            { success: false, error: `Cannot assign permissions you don't have: ${unauthorizedPermissions.join(', ')}` },
            { status: 403 }
          );
        }
      }
    }

    // Update role fields
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (color !== undefined) updateData.color = color;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (mentionable !== undefined) updateData.mentionable = mentionable;
    if (position !== undefined) updateData.position = position;

    const updatedRole = await Role.findByIdAndUpdate(roleId, updateData, { new: true });

    // Create audit log entry
    const auditLog = {
      action: 'ROLE_UPDATE',
      executor: decoded.userId,
      target: roleId,
      changes: updateData,
      timestamp: new Date()
    };

    // Get member count for response
    const memberCount = server.members.filter(member => 
      member.roles.some(roleId => roleId.toString() === updatedRole._id.toString())
    ).length;

    return Response.json({
      success: true,
      message: 'Role updated successfully',
      role: {
        id: updatedRole._id,
        name: updatedRole.name,
        color: updatedRole.color,
        position: updatedRole.position,
        permissions: updatedRole.permissions,
        mentionable: updatedRole.mentionable,
        isDefault: updatedRole.isDefault,
        memberCount,
        server: {
          id: updatedRole.server,
          name: server.name
        },
        updatedAt: updatedRole.updatedAt
      },
      auditLog
    });

  } catch (error) {
    console.error('Update role error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete role
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

    const { roleId } = await params;

    // Find the role
    const role = await Role.findById(roleId).populate('server');

    if (!role) {
      return Response.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      );
    }

    // Prevent deleting @everyone role
    if (role.isDefault) {
      return Response.json(
        { success: false, error: 'Cannot delete @everyone role' },
        { status: 400 }
      );
    }

    // Find the server and check permissions
    const server = await Server.findById(role.server._id)
      .populate('members.user', 'username avatar')
      .populate('roles');

    const member = server.members.find(m => m.user._id.toString() === decoded.userId);
    if (!member) {
      return Response.json(
        { success: false, error: 'You are not a member of this server' },
        { status: 403 }
      );
    }

    const isOwner = server.owner.toString() === decoded.userId;
    let hasManageRolesPermission = false;

    if (!isOwner) {
      const userRoles = server.roles.filter(serverRole => 
        member.roles.some(roleId => roleId.toString() === serverRole._id.toString())
      );
      
      hasManageRolesPermission = userRoles.some(userRole => 
        userRole.permissions && (
          userRole.permissions.includes('MANAGE_ROLES') || userRole.permissions.includes('ADMINISTRATOR')
        )
      );
    }

    if (!isOwner && !hasManageRolesPermission) {
      return Response.json(
        { success: false, error: 'Insufficient permissions - You need MANAGE_ROLES permission' },
        { status: 403 }
      );
    }

    // Check role hierarchy
    if (!isOwner) {
      const userHighestRole = getHighestRolePosition(member.roles, server.roles);
      
      if (role.position >= userHighestRole) {
        return Response.json(
          { success: false, error: 'Cannot delete a role equal to or higher than your highest role' },
          { status: 403 }
        );
      }
    }

    // Remove role from all members
    server.members.forEach(member => {
      member.roles = member.roles.filter(memberRoleId => memberRoleId.toString() !== roleId);
    });

    // Remove role from server
    server.roles = server.roles.filter(serverRoleId => serverRoleId.toString() !== roleId);

    await server.save();

    // Delete the role
    await Role.findByIdAndDelete(roleId);

    // Create audit log entry
    const auditLog = {
      action: 'ROLE_DELETE',
      executor: decoded.userId,
      target: roleId,
      roleName: role.name,
      timestamp: new Date()
    };

    return Response.json({
      success: true,
      message: 'Role deleted successfully',
      deletedRole: {
        id: role._id,
        name: role.name
      },
      auditLog
    });

  } catch (error) {
    console.error('Delete role error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
function getHighestRolePosition(userRoles, serverRoles) {
  if (!userRoles.length) return 0;
  
  const positions = userRoles.map(roleId => {
    const role = serverRoles.find(r => r._id.toString() === roleId.toString());
    return role ? role.position : 0;
  });
  
  return Math.max(...positions);
}

function getUserPermissions(userRoles, serverRoles) {
  const roles = serverRoles.filter(role => 
    userRoles.some(roleId => roleId.toString() === role._id.toString())
  );
  
  const permissions = new Set();
  roles.forEach(role => {
    role.permissions.forEach(perm => permissions.add(perm));
  });
  
  return Array.from(permissions);
}
