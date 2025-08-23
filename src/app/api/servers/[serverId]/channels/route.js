const Channel = require('../../../../../models/Channel');
const Server = require('../../../../../models/Server');
const { verifyToken, extractTokenFromHeader } = require('../../../../../lib/jwt');
const connectDB = require('../../../../../lib/mongodb');
const { getIO } = require('../../../../../socket');

// POST - Create a new channel in a server
export async function POST(request, { params }) {
  try {
    await connectDB();
    
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid token'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { serverId } = await params;
    console.log('Create channel - serverId:', serverId);
    const body = await request.json();
    const { name, type = 'text', description, categoryId, position } = body;

    // Validate input
    if (!name) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Channel name is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!['text', 'voice', 'category'].includes(type)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid channel type. Must be text, voice, or category'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if server exists and user has permission
    const server = await Server.findById(serverId);
    if (!server) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Server not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is a member of the server
    const isMember = server.members.some(member => member.user.toString() === decoded.userId);
    if (!isMember) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You are not a member of this server'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user has permission to create channels (basic check - can be enhanced with role permissions)
    const userMember = server.members.find(member => member.user.toString() === decoded.userId);
    const isOwner = server.owner.toString() === decoded.userId;
    
    if (!isOwner) {
      // For now, only owner can create channels. This can be enhanced with role-based permissions
      return new Response(JSON.stringify({
        success: false,
        error: 'You do not have permission to create channels in this server'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create the channel
    const channelData = {
      name: name.trim(),
      type: type,
      server: serverId,
      position: position || 0
    };

    if (description) {
      channelData.description = description.trim();
    }

    if (categoryId) {
      // Verify category exists and belongs to this server
      const category = await Channel.findOne({
        _id: categoryId,
        server: serverId,
        type: 'category'
      });
      
      if (category) {
        channelData.category = categoryId;
      }
    }

    const channel = new Channel(channelData);
    await channel.save();

    // Add channel to server's channels array
    server.channels.push(channel._id);
    await server.save();

    // Populate channel with category info if exists
    await channel.populate('category', 'name');

    // Get Socket.io instance and notify all server members
    const io = getIO();
    if (io) {
      io.to(`server:${serverId}`).emit('channel-created', {
        channel: {
          id: channel._id,
          name: channel.name,
          type: channel.type,
          description: channel.description,
          position: channel.position,
          category: channel.category
        },
        server: {
          id: serverId,
          name: server.name
        },
        createdBy: {
          id: decoded.userId
        },
        timestamp: new Date()
      });

      console.log(`✅ Channel created: ${channel.name} (${channel.type}) in server ${server.name}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Channel created successfully',
      channel: {
        id: channel._id,
        name: channel.name,
        type: channel.type,
        description: channel.description,
        server: channel.server,
        category: channel.category,
        position: channel.position,
        createdAt: channel.createdAt
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Create channel error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create channel'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET - Get all channels in a server
export async function GET(request, { params }) {
  try {
    await connectDB();
    
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid token'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { serverId } = await params;

    // Check if server exists and user has access
    const server = await Server.findById(serverId);
    if (!server) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Server not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is a member of the server
    const isMember = server.members.some(member => member.user.toString() === decoded.userId);
    if (!isMember) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You are not a member of this server'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all channels in the server
    const channels = await Channel.find({ server: serverId })
      .populate('category', 'name')
      .sort({ position: 1, createdAt: 1 });

    return new Response(JSON.stringify({
      success: true,
      channels: channels.map(channel => ({
        id: channel._id,
        name: channel.name,
        type: channel.type,
        description: channel.description,
        position: channel.position,
        category: channel.category,
        createdAt: channel.createdAt
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get server channels error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get server channels'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
