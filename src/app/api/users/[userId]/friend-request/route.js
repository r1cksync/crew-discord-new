import User from '../../../../../models/User';
import { verifyToken, extractTokenFromHeader } from '../../../../../lib/jwt';
import connectDB from '../../../../../lib/mongodb';
import { getIO } from '../../../../../socket';

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

      // Emit real-time notifications for automatic friendship
      try {
        const io = getIO();
        
        if (io) {
          // Notify both users about the new friendship
          io.to(`user:${userId}`).emit('friend-request-accepted', {
            friend: {
              _id: decoded.userId,
              id: decoded.userId,
              username: requestingUser.username,
              avatar: requestingUser.avatar,
              status: requestingUser.status || 'offline',
              isOnline: requestingUser.isOnline || false
            }
          });

          io.to(`user:${decoded.userId}`).emit('friend-request-accepted', {
            friend: {
              _id: userId,
              id: userId,
              username: targetUser.username,
              avatar: targetUser.avatar,
              status: targetUser.status || 'offline',
              isOnline: targetUser.isOnline || false
            }
          });
          
          console.log(`✅ Automatic friendship notifications sent`);
        } else {
          console.log(`⚠️ Socket.io not initialized, friendship notifications not sent`);
        }
      } catch (socketError) {
        console.log(`⚠️ Socket emission failed:`, socketError.message);
      }

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

    // Emit real-time notification to target user
    try {
      const io = getIO();
      if (io) {
        io.to(`user:${userId}`).emit('friend-request-received', {
          request: {
            _id: newRequest._id,
            from: {
              _id: newRequest.from._id,
              id: newRequest.from._id,
              username: newRequest.from.username,
              avatar: newRequest.from.avatar
            },
            to: userId,
            status: 'pending',
            createdAt: newRequest.createdAt
          }
        });
        console.log(`✅ Friend request notification sent to user:${userId}`);
      } else {
        console.log(`⚠️ Socket.io not initialized, notification not sent`);
      }
    } catch (socketError) {
      console.log(`⚠️ Socket emission failed (user might be offline):`, socketError.message);
    }

    return Response.json({
      success: true,
      message: 'Friend request sent successfully',
      request: {
        _id: newRequest._id,
        from: decoded.userId,
        to: userId,
        status: 'pending',
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
