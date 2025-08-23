const DirectMessage = require('../../../models/DirectMessage');
const User = require('../../../models/User');
const { verifyToken, extractTokenFromHeader } = require('../../../lib/jwt');
const connectDB = require('../../../lib/mongodb');
const { getIO } = require('../../../socket');

// GET - Get direct messages with a specific user
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

    const url = new URL(request.url);
    const recipientId = url.searchParams.get('recipient');

    if (!recipientId) {
      return Response.json(
        { success: false, error: 'Recipient ID is required' },
        { status: 400 }
      );
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId).select('username avatar');
    if (!recipient) {
      return Response.json(
        { success: false, error: 'Recipient not found' },
        { status: 404 }
      );
    }

    // Get direct messages between these two users
    const messages = await DirectMessage.find({
      $or: [
        { sender: decoded.userId, recipient: recipientId },
        { sender: recipientId, recipient: decoded.userId }
      ]
    })
    .populate('sender', 'username avatar status')
    .populate('recipient', 'username avatar status')
    .sort({ createdAt: 1 })
    .limit(50); // Limit to last 50 messages

    return Response.json({
      success: true,
      messages: messages,
      recipient: recipient,
      count: messages.length
    });

  } catch (error) {
    console.error('Get direct messages error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Send a direct message
export async function POST(request) {
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

    const { content, recipientId } = await request.json();

    if (!content || !recipientId) {
      return Response.json(
        { success: false, error: 'Content and recipient ID are required' },
        { status: 400 }
      );
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId).select('username avatar blockedUsers');
    if (!recipient) {
      return Response.json(
        { success: false, error: 'Recipient not found' },
        { status: 404 }
      );
    }

    // Check if sender is blocked by recipient
    const isBlocked = recipient.blockedUsers?.some(blockedId => 
      blockedId.toString() === decoded.userId
    );

    if (isBlocked) {
      return Response.json(
        { success: false, error: 'You cannot send messages to this user' },
        { status: 403 }
      );
    }

    // Get sender details
    const sender = await User.findById(decoded.userId).select('username avatar');

    // Create direct message
    const directMessage = new DirectMessage({
      content: content.trim(),
      sender: decoded.userId,
      recipient: recipientId
    });

    await directMessage.save();

    // Populate the message with sender and recipient details
    await directMessage.populate('sender', 'username avatar status');
    await directMessage.populate('recipient', 'username avatar status');

    // Emit real-time direct message notifications
    try {
      const io = getIO();
      if (io) {
        // Notify the recipient
        io.to(`user:${recipientId}`).emit('dm-received', {
          message: {
            id: directMessage._id,
            content: directMessage.content,
            sender: directMessage.sender,
            recipient: directMessage.recipient,
            createdAt: directMessage.createdAt,
            edited: directMessage.edited
          },
          sender: {
            id: sender._id,
            username: sender.username,
            avatar: sender.avatar
          },
          notification: `New message from ${sender.username}`,
          timestamp: new Date()
        });

        // Confirm to sender that message was sent
        io.to(`user:${decoded.userId}`).emit('dm-sent', {
          message: {
            id: directMessage._id,
            content: directMessage.content,
            sender: directMessage.sender,
            recipient: directMessage.recipient,
            createdAt: directMessage.createdAt,
            edited: directMessage.edited
          },
          recipient: {
            id: recipient._id,
            username: recipient.username,
            avatar: recipient.avatar
          },
          timestamp: new Date()
        });

        console.log(`✅ Direct message notifications sent between users ${decoded.userId} and ${recipientId}`);
      } else {
        console.log(`⚠️ Socket.io not initialized, direct message notifications not sent`);
      }
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
    }

    return Response.json({
      success: true,
      message: 'Direct message sent successfully',
      directMessage: {
        id: directMessage._id,
        content: directMessage.content,
        sender: directMessage.sender,
        recipient: directMessage.recipient,
        createdAt: directMessage.createdAt,
        edited: directMessage.edited
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Send direct message error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
