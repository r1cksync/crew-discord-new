const Server = require('../../../../../../models/Server');
const { verifyToken, extractTokenFromHeader } = require('../../../../../../lib/jwt');
const connectDB = require('../../../../../../lib/mongodb');
const { getIO } = require('../../../../../../socket');

// POST - Generate a new invite code for the server
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

    const server = await Server.findById(serverId);
    if (!server) {
      return Response.json(
        { success: false, error: 'Server not found' },
        { status: 404 }
      );
    }

    // Check if user is the server owner or has admin permissions
    const isOwner = server.owner.toString() === decoded.userId;
    const member = server.members.find(m => m.user.toString() === decoded.userId);
    
    if (!isOwner && !member) {
      return Response.json(
        { success: false, error: 'Access denied - You must be a member of this server' },
        { status: 403 }
      );
    }

    // For now, only owners can regenerate invite codes
    // TODO: Add role-based permissions later
    if (!isOwner) {
      return Response.json(
        { success: false, error: 'Access denied - Only server owners can regenerate invite codes' },
        { status: 403 }
      );
    }

    // Generate new invite code
    const newInviteCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const oldInviteCode = server.inviteCode;
    server.inviteCode = newInviteCode;
    await server.save();

    // Emit real-time invite regenerated notification
    try {
      const io = getIO();
      if (io) {
        // Notify all server members about invite regeneration
        io.to(`server:${serverId}`).emit('invite-regenerated', {
          server: {
            id: server._id,
            name: server.name,
            icon: server.icon
          },
          oldInviteCode: oldInviteCode,
          newInviteCode: newInviteCode,
          regeneratedBy: {
            id: decoded.userId
          },
          message: `Server invite code was regenerated`,
          timestamp: new Date()
        });

        console.log(`✅ Invite regeneration notification sent for server:${serverId}`);
      } else {
        console.log(`⚠️ Socket.io not initialized, invite regeneration notification not sent`);
      }
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
    }

    return Response.json({
      success: true,
      message: 'Invite code regenerated successfully',
      oldInviteCode,
      newInviteCode,
      inviteUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${newInviteCode}`,
      serverName: server.name
    });

  } catch (error) {
    console.error('Regenerate invite error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
