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

    // Get user with populated friend requests (incoming)
    const user = await User.findById(decoded.userId)
      .populate('friendRequests.from', 'username avatar status')
      .select('friendRequests username avatar status');

    if (!user) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Get incoming requests (requests TO this user)
    const incomingRequests = user.friendRequests
      .filter(req => req.status === 'pending')
      .map(req => ({
        id: req._id,
        from: req.from._id,
        fromUser: {
          id: req.from._id,
          username: req.from.username,
          avatar: req.from.avatar,
          status: req.from.status
        },
        to: decoded.userId,
        status: req.status,
        createdAt: req.createdAt,
        type: 'incoming'
      }));

    // Get outgoing requests (requests FROM this user)
    const usersWithOutgoingRequests = await User.find({
      'friendRequests.from': decoded.userId,
      'friendRequests.status': 'pending'
    }).select('_id username avatar status friendRequests');

    const outgoingRequests = [];
    usersWithOutgoingRequests.forEach(targetUser => {
      const request = targetUser.friendRequests.find(req => 
        req.from.toString() === decoded.userId && req.status === 'pending'
      );
      if (request) {
        outgoingRequests.push({
          id: request._id,
          from: decoded.userId,
          fromUser: {
            id: decoded.userId,
            username: user.username,
            avatar: user.avatar,
            status: user.status
          },
          to: targetUser._id,
          toUser: {
            id: targetUser._id,
            username: targetUser.username,
            avatar: targetUser.avatar,
            status: targetUser.status
          },
          status: request.status,
          createdAt: request.createdAt,
          type: 'outgoing'
        });
      }
    });

    // Combine and sort all requests
    const allRequests = [...incomingRequests, ...outgoingRequests]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Newest first

    return Response.json({
      success: true,
      requests: allRequests,
      count: allRequests.length
    });

  } catch (error) {
    console.error('Get friend requests error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
