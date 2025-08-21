import jwt from 'jsonwebtoken';
import User from '../../../../../../../models/User.js';
import { getIO } from '../../../../../../../socket.js';
import { connectDB } from '../../../../../../../lib/mongodb.js';

// POST - Accept friend request
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

    // Find the user who sent the request
    const requestSender = await User.findById(friendRequest.from);
    if (!requestSender) {
      return Response.json(
        { success: false, error: 'Request sender not found' },
        { status: 404 }
      );
    }

    // Check if they're already friends (edge case)
    const alreadyFriends = user.friends.some(friendId => 
      friendId.toString() === requestSender._id.toString()
    );

    if (alreadyFriends) {
      // Update request status and return
      friendRequest.status = 'accepted';
      await user.save();
      
      return Response.json({
        success: true,
        message: 'You are already friends with this user',
        friend: {
          id: requestSender._id,
          username: requestSender.username,
          avatar: requestSender.avatar
        }
      });
    }

    // Accept the friend request
    friendRequest.status = 'accepted';

    // Add each other to friends lists
    user.friends.push(requestSender._id);
    requestSender.friends.push(user._id);

    // Save both users
    await user.save();
    await requestSender.save();

    // Emit real-time events for both users
    try {
      const io = getIO();
      
      if (io) {
        // Notify the original sender that their request was accepted
        io.to(requestSender._id.toString()).emit('friend-request-accepted', {
          friend: {
            id: user._id,
            username: user.username,
            avatar: user.avatar,
            status: user.status,
            isOnline: user.isOnline
          },
          message: `${user.username} accepted your friend request!`
        });

        // Notify the current user (accepter) that they have a new friend
        io.to(user._id.toString()).emit('friend-added', {
          friend: {
            id: requestSender._id,
            username: requestSender.username,
            avatar: requestSender.avatar,
            status: requestSender.status,
            isOnline: requestSender.isOnline
          },
          message: `You are now friends with ${requestSender.username}!`
        });

        console.log(`✅ Friend request acceptance notifications sent`);
      } else {
        console.log(`⚠️ Socket.io not initialized, acceptance notifications not sent`);
      }
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
      // Don't fail the request if socket emission fails
    }

    return Response.json({
      success: true,
      message: 'Friend request accepted',
      friend: {
        id: requestSender._id,
        username: requestSender.username,
        avatar: requestSender.avatar,
        status: requestSender.status,
        isOnline: requestSender.isOnline
      }
    });

  } catch (error) {
    console.error('Accept friend request error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
