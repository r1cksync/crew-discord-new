const User = require('../../../../../../../models/User');
const { verifyToken, extractTokenFromHeader } = require('../../../../../../../lib/jwt');
const connectDB = require('../../../../../../../lib/mongodb');

// POST - Decline friend request
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

    const { requestId } = await params;

    // Find the user and the specific friend request
    const user = await User.findById(decoded.userId);
    if (!user) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const friendRequest = user.friendRequests.id(requestId);
    if (!friendRequest) {
      return Response.json(
        { success: false, error: 'Friend request not found' },
        { status: 404 }
      );
    }

    if (friendRequest.status !== 'pending') {
      return Response.json(
        { success: false, error: 'Friend request already processed' },
        { status: 400 }
      );
    }

    // Find the user who sent the request (for response data)
    const requestSender = await User.findById(friendRequest.from);
    
    // Decline the friend request by removing it
    user.friendRequests.pull(requestId);
    await user.save();

    return Response.json({
      success: true,
      message: 'Friend request declined',
      declinedRequest: {
        id: requestId,
        from: requestSender ? {
          id: requestSender._id,
          username: requestSender.username,
          avatar: requestSender.avatar
        } : null
      }
    });

  } catch (error) {
    console.error('Decline friend request error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
