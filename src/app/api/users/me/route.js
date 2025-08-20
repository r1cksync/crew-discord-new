const User = require('../../../../models/User');
const { verifyToken, extractTokenFromHeader } = require('../../../../lib/jwt');
const { uploadToS3 } = require('../../../../lib/upload');
const connectDB = require('../../../../lib/mongodb');

// GET - Get current user profile
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

    const user = await User.findById(decoded.userId)
      .select('-password')
      .populate('servers', 'name description icon');

    if (!user) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        isOnline: user.isOnline,
        servers: user.servers,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update current user profile
export async function PUT(request) {
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

    // Get form data (handles both text updates and file uploads)
    const formData = await request.formData();
    const username = formData.get('username');
    const status = formData.get('status');
    const avatarFile = formData.get('avatar');

    const updateData = {};

    // Update username if provided
    if (username) {
      // Check if username is already taken
      const existingUser = await User.findOne({
        username,
        _id: { $ne: decoded.userId }
      });

      if (existingUser) {
        return Response.json(
          { success: false, error: 'Username is already taken' },
          { status: 409 }
        );
      }

      updateData.username = username;
    }

    // Update status if provided
    if (status) {
      const validStatuses = ['online', 'away', 'busy', 'offline'];
      if (!validStatuses.includes(status)) {
        return Response.json(
          { success: false, error: 'Invalid status value' },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    // Upload avatar if provided
    if (avatarFile && avatarFile.size > 0) {
      try {
        const buffer = Buffer.from(await avatarFile.arrayBuffer());
        const filename = `${decoded.userId}-${Date.now()}.${avatarFile.name.split('.').pop()}`;
        const uploadResult = await uploadToS3(buffer, avatarFile.name, avatarFile.type, 'avatars', filename);
        updateData.avatar = uploadResult;
      } catch (uploadError) {
        console.error('Avatar upload error:', uploadError);
        return Response.json(
          { success: false, error: 'Avatar upload failed' },
          { status: 500 }
        );
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      decoded.userId,
      updateData,
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        status: updatedUser.status,
        isOnline: updatedUser.isOnline,
        createdAt: updatedUser.createdAt
      }
    });

  } catch (error) {
    console.error('Update user profile error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
