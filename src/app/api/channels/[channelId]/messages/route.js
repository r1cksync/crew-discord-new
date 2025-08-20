const Message = require('../../../../../models/Message');
const Channel = require('../../../../../models/Channel');
const Server = require('../../../../../models/Server');
const { verifyToken, extractTokenFromHeader } = require('../../../../../lib/jwt');
const { uploadToS3 } = require('../../../../../lib/upload');
const connectDB = require('../../../../../lib/mongodb');
const multer = require('multer');
const { NextRequest } = require('next/server');

// GET - Get messages for a channel
export async function GET(request, { params }) {
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

    const { channelId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const before = searchParams.get('before');

    // Verify channel exists and user has access
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return Response.json(
        { success: false, error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Build query
    let query = { 
      channel: channelId,
      deleted: false
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('author', 'username avatar status')
      .populate('mentions', 'username')
      .sort({ createdAt: -1 })
      .limit(limit);

    return Response.json({
      success: true,
      messages: messages.reverse()
    });

  } catch (error) {
    console.error('Get messages error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new message
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

    const { channelId } = await params;

    // Verify channel exists and user has access
    const channel = await Channel.findById(channelId).populate('server');
    if (!channel) {
      return Response.json(
        { success: false, error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Get form data (handles both text and file uploads)
    const formData = await request.formData();
    const content = formData.get('content');
    const files = formData.getAll('files');

    if (!content && files.length === 0) {
      return Response.json(
        { success: false, error: 'Message content or files are required' },
        { status: 400 }
      );
    }

    let attachments = [];

    // Upload files to S3 if present
    if (files.length > 0) {
      for (const file of files) {
        if (file && file.size > 0) {
          try {
            const buffer = Buffer.from(await file.arrayBuffer());
            const filename = `${Date.now()}-${file.name}`;
            const uploadResult = await uploadToS3(buffer, file.name, file.type, 'attachments', filename);
            attachments.push({
              filename: file.name,
              url: uploadResult,
              size: file.size,
              contentType: file.type
            });
          } catch (uploadError) {
            console.error('File upload error:', uploadError);
            return Response.json(
              { success: false, error: 'File upload failed' },
              { status: 500 }
            );
          }
        }
      }
    }

    // Create message
    const message = new Message({
      content: content || '',
      author: decoded.userId,
      channel: channelId,
      server: channel.server._id,
      attachments
    });

    await message.save();

    // Populate message with author details
    await message.populate('author', 'username avatar status');

    return Response.json({
      success: true,
      message: {
        _id: message._id,
        content: message.content,
        author: message.author,
        channel: message.channel,
        server: message.server,
        attachments: message.attachments,
        createdAt: message.createdAt,
        edited: message.edited
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Create message error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
