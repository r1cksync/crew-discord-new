const Server = require('../../../../../models/Server');
const Role = require('../../../../../models/Role');
const { verifyToken, extractTokenFromHeader } = require('../../../../../lib/jwt');
const connectDB = require('../../../../../lib/mongodb');

// GET - Get all roles in a server
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

    // Check if user is a member of the server
    const member = server.members.find(m => m.user._id.toString() === decoded.userId);
    if (!member) {
      return Response.json(
        { success: false, error: 'You are not a member of this server' },
        { status: 403 }
      );
    }

    // Sort roles by position (highest first)
    const sortedRoles = server.roles
      .map(role => ({
        id: role._id,
        name: role.name,
        color: role.color,
        position: role.position,
        permissions: role.permissions,
        mentionable: role.mentionable,
        isDefault: role.isDefault,
        memberCount: server.members.filter(member => 
          member.roles.some(roleId => roleId.toString() === role._id.toString())
        ).length,
        createdAt: role.createdAt
      }))
      .sort((a, b) => b.position - a.position);

    return Response.json({
      success: true,
      roles: sortedRoles,
      totalRoles: sortedRoles.length
    });

  } catch (error) {
    console.error('Get server roles error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new role
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

    const { serverId } = await params;
    const { name, color, permissions, mentionable } = await request.json().catch(() => ({}));

    // Validate role name
    if (!name || name.trim().length === 0) {
      return Response.json(
        { success: false, error: 'Role name is required' },
        { status: 400 }
      );
    }

    if (name.trim().length > 100) {
      return Response.json(
        { success: false, error: 'Role name must be 100 characters or less' },
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

    // Check permissions - user must be owner or have MANAGE_ROLES permission
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
      const userRoles = server.roles.filter(role => 
        member.roles.some(roleId => roleId.toString() === role._id.toString())
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

    // Check for duplicate role name
    const existingRole = server.roles.find(role => 
      role.name.toLowerCase() === name.trim().toLowerCase()
    );
    
    if (existingRole) {
      return Response.json(
        { success: false, error: 'A role with this name already exists' },
        { status: 400 }
      );
    }

    // Validate permissions
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

    const rolePermissions = permissions || [];
    const invalidPermissions = rolePermissions.filter(perm => !validPermissions.includes(perm));
    
    if (invalidPermissions.length > 0) {
      return Response.json(
        { success: false, error: `Invalid permissions: ${invalidPermissions.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if user can assign these permissions (cannot assign permissions they don't have)
    if (!isOwner) {
      const userPermissions = getUserPermissions(member.roles, server.roles);
      const unauthorizedPermissions = rolePermissions.filter(perm => 
        !userPermissions.includes(perm) && !userPermissions.includes('ADMINISTRATOR')
      );
      
      if (unauthorizedPermissions.length > 0) {
        return Response.json(
          { success: false, error: `Cannot assign permissions you don't have: ${unauthorizedPermissions.join(', ')}` },
          { status: 403 }
        );
      }
    }

    // Get the highest position for new role (just below the highest existing non-owner role)
    const maxPosition = Math.max(...server.roles.map(role => role.position));
    const newPosition = maxPosition + 1;

    // Create the role
    const newRole = new Role({
      name: name.trim(),
      color: color || '#99aab5',
      permissions: rolePermissions,
      server: serverId,
      position: newPosition,
      mentionable: mentionable !== undefined ? mentionable : true,
      isDefault: false
    });

    await newRole.save();

    // Add role to server
    server.roles.push(newRole._id);
    await server.save();

    // Create audit log entry
    const auditLog = {
      action: 'ROLE_CREATE',
      executor: decoded.userId,
      target: newRole._id,
      roleName: newRole.name,
      permissions: rolePermissions,
      timestamp: new Date()
    };

    return Response.json({
      success: true,
      message: 'Role created successfully',
      role: {
        id: newRole._id,
        name: newRole.name,
        color: newRole.color,
        position: newRole.position,
        permissions: newRole.permissions,
        mentionable: newRole.mentionable,
        isDefault: newRole.isDefault,
        memberCount: 0,
        createdAt: newRole.createdAt
      },
      auditLog
    }, { status: 201 });

  } catch (error) {
    console.error('Create role error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to get user permissions
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
