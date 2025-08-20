const User = require('../../../../../models/User');
const { verifyToken, extractTokenFromHeader } = require('../../../../../lib/jwt');
const connectDB = require('../../../../../lib/mongodb');

// GET - Get user's friends list
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

    // Get user with populated friends
    const user = await User.findById(decoded.userId)
      .populate('friends', 'username avatar status isOnline lastSeen')
      .select('friends');

    if (!user) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Format friends data with online status priority
    const friends = user.friends
      .map(friend => ({
        id: friend._id,
        username: friend.username,
        avatar: friend.avatar,
        status: friend.status,
        isOnline: friend.isOnline,
        lastSeen: friend.lastSeen
      }))
      .sort((a, b) => {
        // Sort by online status first, then by username
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return a.username.localeCompare(b.username);
      });

    return Response.json({
      success: true,
      friends: friends,
      count: friends.length,
      onlineCount: friends.filter(f => f.isOnline).length
    });

  } catch (error) {
    console.error('Get friends error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
