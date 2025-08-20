const Server = require('../../../../../models/Server');
const { verifyToken, extractTokenFromHeader } = require('../../../../../lib/jwt');
const connectDB = require('../../../../../lib/mongodb');

// GET - Get current invite code for a server
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

    const server = await Server.findById(serverId);
    if (!server) {
      return Response.json(
        { success: false, error: 'Server not found' },
        { status: 404 }
      );
    }

    // Check if user is a member of the server
    const isMember = server.members.some(member => 
      member.user.toString() === decoded.userId
    );

    if (!isMember) {
      return Response.json(
        { success: false, error: 'Access denied - You must be a member of this server' },
        { status: 403 }
      );
    }

    return Response.json({
      success: true,
      inviteCode: server.inviteCode,
      inviteUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${server.inviteCode}`,
      serverName: server.name,
      memberCount: server.members.length
    });

  } catch (error) {
    console.error('Get invite error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
