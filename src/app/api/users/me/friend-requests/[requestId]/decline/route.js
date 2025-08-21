import jwt from 'jsonwebtoken';
import User from '../../../../../../../models/User.js';
import { getIO } from '../../../../../../../socket.js';
import { connectDB } from '../../../../../../../lib/mongodb.js';

// POST - Decline friend request
export async function POST(request, { params }) {
  try {
    await connectDB();
    
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return Response.json(
        { success: false, error: 'Access token is required' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
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

    // Emit real-time event to notify the original sender that their request was declined
    try {
      const io = getIO();
      
      if (io && requestSender) {
        io.to(requestSender._id.toString()).emit('friend-request-declined', {
          decliner: {
            id: user._id,
            username: user.username,
            avatar: user.avatar
          },
          message: `${user.username} declined your friend request.`
        });
        console.log(`✅ Friend request decline notification sent`);
      } else if (!io) {
        console.log(`⚠️ Socket.io not initialized, decline notification not sent`);
      }
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
      // Don't fail the request if socket emission fails
    }

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
