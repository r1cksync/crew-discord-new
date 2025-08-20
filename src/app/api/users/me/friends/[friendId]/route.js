import User from '../../../../../../models/User';
import { verifyToken, extractTokenFromHeader } from '../../../../../../lib/jwt';
import connectDB from '../../../../../../lib/mongodb';

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
