const bcrypt = require('bcryptjs');
const User = require('../../../../models/User');
const { generateToken } = require('../../../../lib/jwt');
const connectDB = require('../../../../lib/mongodb');

export async function POST(request) {
  try {
    await connectDB();
    
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return Response.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return Response.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return Response.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Update user status to online
    await User.findByIdAndUpdate(user._id, {
      isOnline: true,
      status: 'online',
      lastSeen: new Date()
    });

    // Generate token
    const token = generateToken(user._id);

    // Return user without password
    const userResponse = {
      id: user._id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      status: 'online',
      isOnline: true,
      createdAt: user.createdAt
    };

    return Response.json({
      success: true,
      message: 'Login successful',
      user: userResponse,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
