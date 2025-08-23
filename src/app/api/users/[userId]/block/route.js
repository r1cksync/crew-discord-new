import User from '../../../../../models/User';
import { verifyToken, extractTokenFromHeader } from '../../../../../lib/jwt';
import connectDB from '../../../../../lib/mongodb';
import { getIO } from '../../../../../socket';

// POST - Block a user
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

    // Prevent blocking yourself
    if (decoded.userId === userId) {
      return Response.json(
        { success: false, error: 'Cannot block yourself' },
        { status: 400 }
      );
    }

    // Find both users
    const user = await User.findById(decoded.userId);
    const targetUser = await User.findById(userId);

    if (!user || !targetUser) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if already blocked
    const alreadyBlocked = user.blockedUsers?.some(blockedId => 
      blockedId.toString() === userId
    );

    if (alreadyBlocked) {
      return Response.json(
        { success: false, error: 'User is already blocked' },
        { status: 400 }
      );
    }

    // Initialize blockedUsers array if it doesn't exist
    if (!user.blockedUsers) {
      user.blockedUsers = [];
    }

    // Add to blocked users list
    user.blockedUsers.push(userId);

    // Remove from friends list if they were friends
    const wereFriends = user.friends.some(friendId => friendId.toString() === userId);
    if (wereFriends) {
      user.friends = user.friends.filter(friendId => friendId.toString() !== userId);
      targetUser.friends = targetUser.friends.filter(friendId => friendId.toString() !== decoded.userId);
    }

    // Remove any pending friend requests between them
    user.friendRequests = user.friendRequests.filter(req => 
      req.from.toString() !== userId
    );
    targetUser.friendRequests = targetUser.friendRequests.filter(req => 
      req.from.toString() !== decoded.userId
    );

    // Save both users
    await user.save();
    await targetUser.save();

    // Emit real-time blocking notification
    try {
      const io = getIO();
      if (io) {
        // Notify the blocked user
        io.to(`user:${userId}`).emit('blocked-by-user', {
          blocker: {
            id: user._id,
            username: user.username,
            avatar: user.avatar
          },
          message: `You have been blocked by ${user.username}`,
          timestamp: new Date()
        });

        // Notify the blocking user for confirmation
        io.to(`user:${decoded.userId}`).emit('user-blocked', {
          blockedUser: {
            id: targetUser._id,
            username: targetUser.username,
            avatar: targetUser.avatar
          },
          message: `You have blocked ${targetUser.username}`,
          timestamp: new Date()
        });

        console.log(`✅ Block notifications sent between users ${decoded.userId} and ${userId}`);
      } else {
        console.log(`⚠️ Socket.io not initialized, block notifications not sent`);
      }
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
    }

    return Response.json({
      success: true,
      message: 'User blocked successfully',
      blockedUser: {
        id: targetUser._id,
        username: targetUser.username,
        avatar: targetUser.avatar
      }
    });

  } catch (error) {
    console.error('Block user error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Unblock a user
export async function DELETE(request, { params }) {
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

    // Find the user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is actually blocked
    const isBlocked = user.blockedUsers?.some(blockedId => 
      blockedId.toString() === userId
    );

    if (!isBlocked) {
      return Response.json(
        { success: false, error: 'User is not blocked' },
        { status: 400 }
      );
    }

    // Remove from blocked users list
    user.blockedUsers = user.blockedUsers.filter(blockedId => 
      blockedId.toString() !== userId
    );

    await user.save();

    // Get target user info for response
    const targetUser = await User.findById(userId).select('username avatar');

    // Emit real-time unblocking notification
    try {
      const io = getIO();
      if (io) {
        // Notify the unblocked user
        io.to(`user:${userId}`).emit('unblocked-by-user', {
          unblocker: {
            id: user._id,
            username: user.username,
            avatar: user.avatar
          },
          message: `You have been unblocked by ${user.username}`,
          timestamp: new Date()
        });

        // Notify the unblocking user for confirmation
        io.to(`user:${decoded.userId}`).emit('user-unblocked', {
          unblockedUser: {
            id: targetUser._id,
            username: targetUser.username,
            avatar: targetUser.avatar
          },
          message: `You have unblocked ${targetUser.username}`,
          timestamp: new Date()
        });

        console.log(`✅ Unblock notifications sent between users ${decoded.userId} and ${userId}`);
      } else {
        console.log(`⚠️ Socket.io not initialized, unblock notifications not sent`);
      }
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
    }

    return Response.json({
      success: true,
      message: 'User unblocked successfully',
      unblockedUser: {
        id: targetUser._id,
        username: targetUser.username,
        avatar: targetUser.avatar
      }
    });

  } catch (error) {
    console.error('Unblock user error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
