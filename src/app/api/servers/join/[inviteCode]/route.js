const Server = require('../../../../../models/Server');
const User = require('../../../../../models/User');
const { verifyToken, extractTokenFromHeader } = require('../../../../../lib/jwt');
const connectDB = require('../../../../../lib/mongodb');
const { getIO } = require('../../../../../socket');

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

    // Check if user is banned from this server
    const isBanned = server.bannedUsers && server.bannedUsers.some(ban => 
      ban.user.toString() === decoded.userId
    );

    if (isBanned) {
      return Response.json(
        { error: 'You are banned from this server' },
        { status: 403 }
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

    // Get user details for notifications
    const joiningUser = await User.findById(decoded.userId).select('username avatar status');

    // Emit real-time notifications
    try {
      const io = getIO();
      if (io) {
        // Notify all server members about new member
        io.to(`server:${server._id}`).emit('member-joined', {
          member: {
            user: {
              id: joiningUser._id,
              username: joiningUser.username,
              avatar: joiningUser.avatar,
              status: joiningUser.status
            },
            roles: [],
            joinedAt: new Date()
          },
          server: {
            id: server._id,
            name: server.name
          },
          message: `${joiningUser.username} joined the server!`
        });

        // Notify the joining user
        io.to(`user:${decoded.userId}`).emit('server-joined', {
          server: {
            id: server._id,
            name: server.name,
            description: server.description,
            icon: server.icon,
            memberCount: server.members.length
          },
          message: `Successfully joined ${server.name}!`
        });

        // Notify server owner about invite usage
        io.to(`user:${server.owner}`).emit('invite-used', {
          invite: {
            code: inviteCode,
            usedBy: {
              id: joiningUser._id,
              username: joiningUser.username,
              avatar: joiningUser.avatar
            }
          },
          server: {
            id: server._id,
            name: server.name,
            memberCount: server.members.length
          },
          message: `${joiningUser.username} joined ${server.name} using an invite`,
          timestamp: new Date()
        });

        console.log(`✅ Server join notifications sent for user:${decoded.userId} joining server:${server._id}`);
      } else {
        console.log(`⚠️ Socket.io not initialized, server join notifications not sent`);
      }
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
    }

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
