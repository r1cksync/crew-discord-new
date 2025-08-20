const Server = require('../../../../models/Server');
const connectDB = require('../../../../lib/mongodb');

// GET - Validate and get server info from invite code (public endpoint)
export async function GET(request, { params }) {
  try {
    await connectDB();
    
    const { inviteCode } = await params;

    // Find server by invite code
    const server = await Server.findOne({ inviteCode })
      .populate('owner', 'username avatar')
      .select('name description icon members isPublic createdAt inviteCode');

    if (!server) {
      return Response.json(
        { success: false, error: 'Invalid invite code' },
        { status: 404 }
      );
    }

    // Return server preview information
    return Response.json({
      success: true,
      valid: true,
      server: {
        id: server._id,
        name: server.name,
        description: server.description,
        icon: server.icon,
        memberCount: server.members?.length || 0,
        isPublic: server.isPublic,
        createdAt: server.createdAt,
        owner: {
          username: server.owner.username,
          avatar: server.owner.avatar
        }
      },
      inviteCode: server.inviteCode
    });

  } catch (error) {
    console.error('Validate invite error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
