const Server = require('../../../models/Server');
const Channel = require('../../../models/Channel');
const Role = require('../../../models/Role');
const User = require('../../../models/User');
const { verifyToken, extractTokenFromHeader } = require('../../../lib/jwt');
const connectDB = require('../../../lib/mongodb');

// GET - Get all servers for a user
export async function GET(request) {
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

    const user = await User.findById(decoded.userId).populate({
      path: 'servers',
      populate: [
        { path: 'channels' },
        { path: 'members.user', select: 'username avatar status isOnline' }
      ]
    });

    if (!user) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return Response.json({
      servers: user.servers
    });

  } catch (error) {
    console.error('Get servers error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new server
export async function POST(request) {
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

    const { name, description } = await request.json();

    if (!name) {
      return Response.json(
        { error: 'Server name is required' },
        { status: 400 }
      );
    }

    // Create the server
    const server = new Server({
      name,
      description,
      owner: decoded.userId,
      members: [{
        user: decoded.userId,
        roles: [],
        joinedAt: new Date()
      }]
    });

    await server.save();

    // Create default role (everyone)
    const defaultRole = new Role({
      name: '@everyone',
      server: server._id,
      permissions: ['READ_MESSAGES', 'SEND_MESSAGES', 'CONNECT', 'SPEAK'],
      isDefault: true
    });

    await defaultRole.save();

    // Create default channels
    const generalCategory = new Channel({
      name: 'Text Channels',
      type: 'category',
      server: server._id,
      position: 0
    });

    await generalCategory.save();

    const generalChannel = new Channel({
      name: 'general',
      type: 'text',
      server: server._id,
      category: generalCategory._id,
      position: 1
    });

    await generalChannel.save();

    const voiceCategory = new Channel({
      name: 'Voice Channels',
      type: 'category',
      server: server._id,
      position: 2
    });

    await voiceCategory.save();

    const generalVoice = new Channel({
      name: 'General',
      type: 'voice',
      server: server._id,
      category: voiceCategory._id,
      position: 3
    });

    await generalVoice.save();

    // Update server with channels and roles
    server.channels = [generalCategory._id, generalChannel._id, voiceCategory._id, generalVoice._id];
    server.roles = [defaultRole._id];
    await server.save();

    // Add server to user's servers list
    await User.findByIdAndUpdate(decoded.userId, {
      $push: { servers: server._id }
    });

    const populatedServer = await Server.findById(server._id)
      .populate('channels')
      .populate('roles')
      .populate('members.user', 'username avatar status isOnline');

    return Response.json({
      message: 'Server created successfully',
      server: populatedServer
    }, { status: 201 });

  } catch (error) {
    console.error('Create server error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
