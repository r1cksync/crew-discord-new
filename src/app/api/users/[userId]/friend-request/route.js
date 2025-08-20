import User from '../../../../../models/User';
import { verifyToken, extractTokenFromHeader } from '../../../../../lib/jwt';
import connectDB from '../../../../../lib/mongodb';

// POST - Send friend request to a user
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

    const { userId } = await params;

    // Prevent sending friend request to yourself
    if (decoded.userId === userId) {
      return Response.json(
        { success: false, error: 'Cannot send friend request to yourself' },
        { status: 400 }
      );
    }

    // Find the target user
    const targetUser = await User.findById(userId).select('username avatar friends friendRequests blockedUsers');
    if (!targetUser) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Find the requesting user
    const requestingUser = await User.findById(decoded.userId).select('username avatar friends friendRequests blockedUsers');

    // Check if users are already friends
    const areAlreadyFriends = targetUser.friends.some(friendId => 
      friendId.toString() === decoded.userId
    );

    if (areAlreadyFriends) {
      return Response.json(
        { success: false, error: 'You are already friends with this user' },
        { status: 400 }
      );
    }

    // Check if either user has blocked the other
    const isBlocked = targetUser.blockedUsers?.some(blockedId => 
      blockedId.toString() === decoded.userId
    ) || requestingUser.blockedUsers?.some(blockedId => 
      blockedId.toString() === userId
    );

    if (isBlocked) {
      return Response.json(
        { success: false, error: 'Cannot send friend request to this user' },
        { status: 403 }
      );
    }

    // Check if there's already a pending request from either user
    const existingRequest = targetUser.friendRequests.find(req => 
      req.from.toString() === decoded.userId && req.status === 'pending'
    );

    const reverseRequest = requestingUser.friendRequests.find(req => 
      req.from.toString() === userId && req.status === 'pending'
    );

    if (existingRequest) {
      return Response.json(
        { success: false, error: 'Friend request already sent' },
        { status: 400 }
      );
    }

    // If there's a reverse request, automatically accept both
    if (reverseRequest) {
      // Accept the reverse request
      reverseRequest.status = 'accepted';
      await requestingUser.save();

      // Add each other as friends
      targetUser.friends.push(decoded.userId);
      requestingUser.friends.push(userId);

      await targetUser.save();
      await requestingUser.save();

      return Response.json({
        success: true,
        message: 'Friend request accepted automatically',
        friendship: {
          friend: {
            id: targetUser._id,
            username: targetUser.username,
            avatar: targetUser.avatar
          }
        }
      });
    }

    // Create new friend request
    targetUser.friendRequests.push({
      from: decoded.userId,
      status: 'pending',
      createdAt: new Date()
    });

    await targetUser.save();

    // Populate the friend request for response
    await targetUser.populate('friendRequests.from', 'username avatar');
    const newRequest = targetUser.friendRequests[targetUser.friendRequests.length - 1];

    return Response.json({
      success: true,
      message: 'Friend request sent successfully',
      friendRequest: {
        id: newRequest._id,
        from: {
          id: newRequest.from._id,
          username: newRequest.from.username,
          avatar: newRequest.from.avatar
        },
        status: newRequest.status,
        createdAt: newRequest.createdAt
      }
    });

  } catch (error) {
    console.error('Send friend request error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
