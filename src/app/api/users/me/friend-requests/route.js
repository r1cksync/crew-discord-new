import User from '../../../../../models/User';
import { verifyToken, extractTokenFromHeader } from '../../../../../lib/jwt';
import connectDB from '../../../../../lib/mongodb';

// GET - Get pending friend requests
export async function GET(request) {
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

    // Get user with populated friend requests
    const user = await User.findById(decoded.userId)
      .populate('friendRequests.from', 'username avatar status')
      .select('friendRequests');

    if (!user) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Filter only pending requests and format data
    const pendingRequests = user.friendRequests
      .filter(req => req.status === 'pending')
      .map(req => ({
        id: req._id,
        from: {
          id: req.from._id,
          username: req.from.username,
          avatar: req.from.avatar,
          status: req.from.status
        },
        status: req.status,
        createdAt: req.createdAt
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Newest first

    return Response.json({
      success: true,
      friendRequests: pendingRequests,
      count: pendingRequests.length
    });

  } catch (error) {
    console.error('Get friend requests error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
