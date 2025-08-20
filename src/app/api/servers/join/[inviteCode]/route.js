const Server = require('../../../../../models/Server');
const User = require('../../../../../models/User');
const { verifyToken, extractTokenFromHeader } = require('../../../../../lib/jwt');
const connectDB = require('../../../../../lib/mongodb');

// POST - Join a server by invite code
export async function POST(request, { params }) {
  try {
    await connectDB();
    
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return Response.json(
        { error: 'Access token is required' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return Response.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { inviteCode } = await params;

    // Find server by invite code
    const server = await Server.findOne({ inviteCode })
      .populate('channels')
      .populate('roles')
      .populate('members.user', 'username avatar status isOnline');

    if (!server) {
      return Response.json(
        { error: 'Invalid invite code' },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const isAlreadyMember = server.members.some(member => 
      member.user._id.toString() === decoded.userId
    );

    if (isAlreadyMember) {
      return Response.json(
        { error: 'You are already a member of this server' },
        { status: 400 }
      );
    }

    // Add user to server members
    server.members.push({
      user: decoded.userId,
      roles: [], // Will be assigned default roles later
      joinedAt: new Date()
    });

    await server.save();

    // Add server to user's servers list
    await User.findByIdAndUpdate(decoded.userId, {
      $push: { servers: server._id }
    });

    return Response.json({
      success: true,
      message: 'Successfully joined server',
      server: {
        id: server._id,
        name: server.name,
        description: server.description,
        icon: server.icon,
        memberCount: server.members.length
      }
    });

  } catch (error) {
    console.error('Join server error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
