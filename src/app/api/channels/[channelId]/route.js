const Channel = require('../../../models/Channel');
const Server = require('../../../models/Server');
const { verifyToken, extractTokenFromHeader } = require('../../../lib/jwt');
const connectDB = require('../../../lib/mongodb');

// GET - Get channel details
export async function GET(request, { params }) {
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

    const { channelId } = await params;

    const channel = await Channel.findById(channelId)
      .populate('server', 'name members')
      .populate('category', 'name');

    if (!channel) {
      return Response.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Check if user is member of the server
    const server = await Server.findById(channel.server._id);
    const isMember = server.members.some(member => 
      member.user.toString() === decoded.userId
    );

    if (!isMember) {
      return Response.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return Response.json({
      success: true,
      channel
    });

  } catch (error) {
    console.error('Get channel error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update channel
export async function PUT(request, { params }) {
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

    const { channelId } = await params;
    const { name, description, topic } = await request.json();

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return Response.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to manage channels
    const server = await Server.findById(channel.server);
    if (server.owner.toString() !== decoded.userId) {
      return Response.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Update channel
    if (name) channel.name = name;
    if (description) channel.description = description;
    if (topic) channel.topic = topic;

    await channel.save();

    return Response.json({
      success: true,
      message: 'Channel updated successfully',
      channel
    });

  } catch (error) {
    console.error('Update channel error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete channel
export async function DELETE(request, { params }) {
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

    const { channelId } = await params;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return Response.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to manage channels
    const server = await Server.findById(channel.server);
    if (server.owner.toString() !== decoded.userId) {
      return Response.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Remove channel from server
    await Server.findByIdAndUpdate(channel.server, {
      $pull: { channels: channelId }
    });

    // Delete the channel
    await Channel.findByIdAndDelete(channelId);

    return Response.json({
      success: true,
      message: 'Channel deleted successfully'
    });

  } catch (error) {
    console.error('Delete channel error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
