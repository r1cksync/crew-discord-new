const User = require('../../../../models/User');
const { verifyToken, extractTokenFromHeader } = require('../../../../lib/jwt');
const connectDB = require('../../../../lib/mongodb');

// GET - Search users by username or email
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
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return Response.json(
        { success: false, error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Search for users by username or email (case-insensitive)
    const users = await User.find({
      $and: [
        {
          _id: { $ne: decoded.userId } // Exclude current user
        },
        {
          $or: [
            { username: { $regex: query.trim(), $options: 'i' } },
            { email: { $regex: query.trim(), $options: 'i' } }
          ]
        }
      ]
    })
    .select('username email avatar status')
    .limit(10); // Limit results

    return Response.json({
      success: true,
      users: users
    });

  } catch (error) {
    console.error('User search error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
