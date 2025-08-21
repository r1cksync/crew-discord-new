import User from '../../../../../../models/User.js';
import jwt from 'jsonwebtoken';
import connectDB from '../../../../../../lib/mongodb.js';
import { getIO } from '../../../../../../socket.js';

// Helper functions
function extractTokenFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// GET - Get user's friends list
export async function GET(request) {
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

    // Format friends data
    const friends = user.friends.map(friend => ({
      id: friend._id,
      username: friend.username,
      avatar: friend.avatar,
      status: friend.status,
      isOnline: friend.isOnline,
      lastSeen: friend.lastSeen
    }));

    return Response.json({
      success: true,
      friends: friends,
      count: friends.length
    });

  } catch (error) {
    console.error('Get friends error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a friend
export async function DELETE(request, { params }) {
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

    const { friendId } = await params;

    // Find both users
    const user = await User.findById(decoded.userId);
    const friend = await User.findById(friendId);

    if (!user || !friend) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if they are actually friends
    const areFriends = user.friends.some(id => id.toString() === friendId);
    if (!areFriends) {
      return Response.json(
        { success: false, error: 'You are not friends with this user' },
        { status: 400 }
      );
    }

    // Remove from both friends lists
    user.friends = user.friends.filter(id => id.toString() !== friendId);
    friend.friends = friend.friends.filter(id => id.toString() !== decoded.userId);

    await user.save();
    await friend.save();

    // Emit real-time events to both users
    try {
      const io = getIO();
      
      if (io) {
        // Notify the removed friend
        io.to(friend._id.toString()).emit('friend-removed', {
          remover: {
            id: user._id,
            username: user.username,
            avatar: user.avatar
          },
          message: `${user.username} removed you from their friends list`
        });

        // Notify the current user (for consistency)
        io.to(user._id.toString()).emit('friend-removed-by-you', {
          friend: {
            id: friend._id,
            username: friend.username,
            avatar: friend.avatar
          },
          message: `You removed ${friend.username} from your friends list`
        });

        console.log(`✅ Friend removal notifications sent`);
      } else {
        console.log(`⚠️ Socket.io not initialized, removal notifications not sent`);
      }
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
      // Don't fail the request if socket emission fails
    }

    return Response.json({
      success: true,
      message: 'Friend removed successfully',
      removedFriend: {
        id: friend._id,
        username: friend.username,
        avatar: friend.avatar
      }
    });

  } catch (error) {
    console.error('Remove friend error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
