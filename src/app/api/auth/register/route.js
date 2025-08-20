const bcrypt = require('bcryptjs');
const User = require('../../../../models/User');
const { generateToken } = require('../../../../lib/jwt');
const connectDB = require('../../../../lib/mongodb');

export async function POST(request) {
  try {
    await connectDB();
    
    const { email, password, username } = await request.json();

    // Validate input
    if (!email || !password || !username) {
      return Response.json(
        { error: 'Email, password, and username are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return Response.json(
        { error: 'User with this email or username already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      email,
      username,
      password: hashedPassword
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Return user without password
    const userResponse = {
      id: user._id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      status: user.status,
      createdAt: user.createdAt
    };

    return Response.json({
      message: 'User created successfully',
      user: userResponse,
      token
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
