const User = require('../../../../models/User');
const { verifyToken, extractTokenFromHeader } = require('../../../../lib/jwt');
const connectDB = require('../../../../lib/mongodb');

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

    // Update user status to offline
    await User.findByIdAndUpdate(decoded.userId, {
      isOnline: false,
      status: 'offline',
      lastSeen: new Date()
    });

    return Response.json({
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
