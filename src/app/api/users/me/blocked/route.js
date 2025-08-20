const User = require('../../../../../models/User');
const { verifyToken, extractTokenFromHeader } = require('../../../../../lib/jwt');
const connectDB = require('../../../../../lib/mongodb');

// GET - Get blocked users list
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

    // Get user with populated blocked users
    const user = await User.findById(decoded.userId)
      .populate('blockedUsers', 'username avatar')
      .select('blockedUsers');

    if (!user) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Format blocked users data
    const blockedUsers = (user.blockedUsers || []).map(blockedUser => ({
      id: blockedUser._id,
      username: blockedUser.username,
      avatar: blockedUser.avatar
    }));

    return Response.json({
      success: true,
      blockedUsers: blockedUsers,
      count: blockedUsers.length
    });

  } catch (error) {
    console.error('Get blocked users error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
