const Server = require('../models/Server');

/**
 * Middleware to check if a user has specific permissions in a server
 * @param {string|string[]} requiredPermissions - Permission(s) required
 * @returns {function} Express middleware function
 */
function checkPermissions(requiredPermissions) {
  return async (req, res, next) => {
    try {
      const { serverId } = req.params;
      const userId = req.user.userId; // Set by auth middleware

      if (!serverId) {
        return res.status(400).json({
          success: false,
          error: 'Server ID is required'
        });
      }

      // Find the server with populated roles
      const server = await Server.findById(serverId)
        .populate('roles')
        .populate('members.user', 'username');

      if (!server) {
        return res.status(404).json({
          success: false,
          error: 'Server not found'
        });
      }

      // Check if user is a member of the server
      const member = server.members.find(m => m.user._id.toString() === userId);
      if (!member) {
        return res.status(403).json({
          success: false,
          error: 'You are not a member of this server'
        });
      }

      // Server owner has all permissions
      if (server.owner.toString() === userId) {
        req.server = server;
        req.member = member;
        req.isOwner = true;
        return next();
      }

      // Get user's roles
      const userRoles = server.roles.filter(role => 
        member.roles.some(roleId => roleId.toString() === role._id.toString())
      );

      // Check for ADMINISTRATOR permission (grants all permissions)
      const hasAdministrator = userRoles.some(role => 
        role.permissions.includes('ADMINISTRATOR')
      );

      if (hasAdministrator) {
        req.server = server;
        req.member = member;
        req.isOwner = false;
        req.userPermissions = ['ADMINISTRATOR'];
        return next();
      }

      // Get all user permissions
      const userPermissions = new Set();
      userRoles.forEach(role => {
        role.permissions.forEach(perm => userPermissions.add(perm));
      });

      // Check if user has required permissions
      const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
      const hasPermission = permissions.some(perm => userPermissions.has(perm));

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: `Insufficient permissions - Required: ${permissions.join(' or ')}`,
          requiredPermissions: permissions,
          userPermissions: Array.from(userPermissions)
        });
      }

      // Attach server and member info to request
      req.server = server;
      req.member = member;
      req.isOwner = false;
      req.userPermissions = Array.from(userPermissions);

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error during permission check'
      });
    }
  };
}

/**
 * Check if a user is currently timed out in a server
 * @param {string} userId - User ID to check
 * @param {Object} server - Server object
 * @returns {boolean} True if user is timed out
 */
function isUserTimedOut(userId, server) {
  if (!server.timeouts) return false;

  const userTimeout = server.timeouts.find(timeout => 
    timeout.user.toString() === userId && 
    new Date() < new Date(timeout.timeoutUntil)
  );

  return !!userTimeout;
}

/**
 * Check if a user is banned from a server
 * @param {string} userId - User ID to check
 * @param {Object} server - Server object
 * @returns {boolean} True if user is banned
 */
function isUserBanned(userId, server) {
  if (!server.bannedUsers) return false;

  return server.bannedUsers.some(ban => ban.user.toString() === userId);
}

/**
 * Get the highest role position for a user
 * @param {Array} userRoles - Array of user's role IDs
 * @param {Array} serverRoles - Array of all server roles
 * @returns {number} Highest role position
 */
function getHighestRolePosition(userRoles, serverRoles) {
  if (!userRoles.length) return 0;
  
  const positions = userRoles.map(roleId => {
    const role = serverRoles.find(r => r._id.toString() === roleId.toString());
    return role ? role.position : 0;
  });
  
  return Math.max(...positions);
}

/**
 * Check if user can moderate another user based on role hierarchy
 * @param {Object} moderator - Moderator member object
 * @param {Object} target - Target member object
 * @param {Array} serverRoles - All server roles
 * @param {string} serverId - Server ID
 * @param {string} ownerId - Server owner ID
 * @returns {boolean} True if moderator can moderate target
 */
function canModerateUser(moderator, target, serverRoles, serverId, ownerId) {
  // Owner can moderate anyone
  if (moderator.user._id.toString() === ownerId) return true;
  
  // Cannot moderate owner
  if (target.user._id.toString() === ownerId) return false;
  
  // Cannot moderate yourself
  if (moderator.user._id.toString() === target.user._id.toString()) return false;
  
  // Check role hierarchy
  const moderatorHighestRole = getHighestRolePosition(moderator.roles, serverRoles);
  const targetHighestRole = getHighestRolePosition(target.roles, serverRoles);
  
  return moderatorHighestRole > targetHighestRole;
}

/**
 * Get all permissions for a user in a server
 * @param {Array} userRoles - User's role IDs
 * @param {Array} serverRoles - All server roles
 * @returns {Array} Array of permission strings
 */
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

/**
 * Clean up expired timeouts for a server
 * @param {Object} server - Server object
 * @returns {boolean} True if any timeouts were removed
 */
async function cleanupExpiredTimeouts(server) {
  if (!server.timeouts) return false;

  const originalLength = server.timeouts.length;
  const now = new Date();
  
  server.timeouts = server.timeouts.filter(timeout => 
    new Date(timeout.timeoutUntil) > now
  );

  if (server.timeouts.length !== originalLength) {
    await server.save();
    return true;
  }

  return false;
}

module.exports = {
  checkPermissions,
  isUserTimedOut,
  isUserBanned,
  getHighestRolePosition,
  canModerateUser,
  getUserPermissions,
  cleanupExpiredTimeouts
};
