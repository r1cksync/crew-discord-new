# Discord Clone Backend API Documentation

A comprehensive Discord clone backend built with Next.js, Socket.io, MongoDB, and AWS S3 integration.

## 🚀 Features

- **Real-time messaging** with Socket.io
- **User authentication** with JWT
- **Server and channel management**
- **File uploads** with AWS S3
- **Message editing and reactions**
- **Typing indicators**
- **User status updates**
- **Role-based permissions**
- **Direct messaging**

## 📋 Table of Contents

1. [Setup & Installation](#setup--installation)
2. [Environment Variables](#environment-variables)
3. [Database Models](#database-models)
4. [REST API Endpoints](#rest-api-endpoints)
5. [Socket.io Events](#socketio-events)
6. [Authentication](#authentication)
7. [File Upload](#file-upload)
8. [Testing](#testing)
9. [Error Handling](#error-handling)

## 🛠 Setup & Installation

```bash
# Clone the repository
git clone <repository-url>

# Navigate to backend directory
cd crew-discord-new/backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Start development server
npm run dev

# Run tests
npm run test:socket
npm run test:comprehensive
```

## 🌐 Environment Variables

Create a `.env.local` file with the following variables:

```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/discord-clone

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket-name

# Server Configuration
PORT=3001
NODE_ENV=development
SOCKET_CORS_ORIGIN=http://localhost:3000
```

## 📊 Database Models

### User Model
```javascript
{
  _id: ObjectId,
  username: String (required, unique),
  email: String (required, unique),
  password: String (required, hashed),
  avatar: String (S3 URL),
  status: String (online/away/busy/offline),
  isOnline: Boolean,
  lastSeen: Date,
  servers: [ObjectId] (references to Server),
  friends: [ObjectId] (references to User),
  createdAt: Date,
  updatedAt: Date
}
```

### Server Model
```javascript
{
  _id: ObjectId,
  name: String (required),
  description: String,
  icon: String (S3 URL),
  inviteCode: String (unique),
  owner: ObjectId (reference to User),
  members: [ObjectId] (references to User),
  channels: [ObjectId] (references to Channel),
  roles: [Role Schema],
  createdAt: Date,
  updatedAt: Date
}
```

### Channel Model
```javascript
{
  _id: ObjectId,
  name: String (required),
  type: String (text/voice/announcement),
  topic: String,
  server: ObjectId (reference to Server),
  permissions: [Permission Schema],
  createdAt: Date,
  updatedAt: Date
}
```

### Message Model
```javascript
{
  _id: ObjectId,
  content: String (required),
  author: ObjectId (reference to User),
  channel: ObjectId (reference to Channel),
  server: ObjectId (reference to Server),
  attachments: [String] (S3 URLs),
  edited: Boolean,
  editedAt: Date,
  reactions: [Reaction Schema],
  createdAt: Date,
  updatedAt: Date
}
```

### DirectMessage Model
```javascript
{
  _id: ObjectId,
  content: String (required),
  sender: ObjectId (reference to User),
  recipient: ObjectId (reference to User),
  attachments: [String] (S3 URLs),
  read: Boolean,
  edited: Boolean,
  editedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## 🔗 REST API Endpoints

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "_id": "64f8b123...",
    "username": "johndoe",
    "email": "john@example.com",
    "avatar": null,
    "status": "online"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST `/api/auth/login`
Login with existing credentials.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "_id": "64f8b123...",
    "username": "johndoe",
    "email": "john@example.com",
    "avatar": null,
    "status": "online"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST `/api/auth/logout`
Logout current user (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Server Endpoints

#### GET `/api/servers`
Get all servers for the authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "servers": [
    {
      "_id": "64f8b123...",
      "name": "My Gaming Server",
      "description": "A place for gaming discussions",
      "icon": "https://s3.amazonaws.com/bucket/server-icon.png",
      "inviteCode": "abc123xyz",
      "owner": "64f8b123...",
      "members": ["64f8b123...", "64f8b456..."],
      "channels": [
        {
          "_id": "64f8b789...",
          "name": "general",
          "type": "text"
        }
      ]
    }
  ]
}
```

#### POST `/api/servers`
Create a new server.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "My New Server",
  "description": "A cool new server",
  "icon": "optional-base64-or-url"
}
```

**Response:**
```json
{
  "success": true,
  "server": {
    "_id": "64f8b123...",
    "name": "My New Server",
    "description": "A cool new server",
    "inviteCode": "xyz789abc",
    "owner": "64f8b123...",
    "channels": [
      {
        "_id": "64f8b456...",
        "name": "general",
        "type": "text"
      }
    ]
  }
}
```

#### POST `/api/servers/join/[inviteCode]`
Join a server using an invite code.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "server": {
    "_id": "64f8b123...",
    "name": "Server Name",
    "description": "Server description"
  },
  "message": "Successfully joined server"
}
```

#### PUT `/api/servers/[serverId]`
Update server information (owner only).

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Updated Server Name",
  "description": "Updated description"
}
```

#### DELETE `/api/servers/[serverId]`
Delete a server (owner only).

**Headers:**
```
Authorization: Bearer <token>
```

### Channel Endpoints

#### GET `/api/servers/[serverId]/channels`
Get all channels in a server.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "channels": [
    {
      "_id": "64f8b123...",
      "name": "general",
      "type": "text",
      "topic": "General discussion",
      "server": "64f8b456..."
    }
  ]
}
```

#### POST `/api/servers/[serverId]/channels`
Create a new channel in a server.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "new-channel",
  "type": "text",
  "topic": "Channel for specific discussions"
}
```

#### PUT `/api/channels/[channelId]`
Update channel information.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "updated-channel-name",
  "topic": "Updated topic"
}
```

#### DELETE `/api/channels/[channelId]`
Delete a channel.

**Headers:**
```
Authorization: Bearer <token>
```

### Message Endpoints

#### GET `/api/channels/[channelId]/messages`
Get messages from a channel with pagination.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of messages to fetch (default: 50)
- `before` (optional): Message ID to fetch messages before
- `after` (optional): Message ID to fetch messages after

**Response:**
```json
{
  "success": true,
  "messages": [
    {
      "_id": "64f8b123...",
      "content": "Hello world!",
      "author": {
        "_id": "64f8b456...",
        "username": "johndoe",
        "avatar": "https://s3.amazonaws.com/bucket/avatar.png"
      },
      "channel": "64f8b789...",
      "attachments": [],
      "edited": false,
      "reactions": [],
      "createdAt": "2023-09-06T10:30:00.000Z"
    }
  ],
  "hasMore": true
}
```

#### POST `/api/channels/[channelId]/messages`
Send a new message to a channel.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `content`: Message content (required)
- `files`: File attachments (optional)

**Response:**
```json
{
  "success": true,
  "message": {
    "_id": "64f8b123...",
    "content": "Hello world!",
    "author": {
      "_id": "64f8b456...",
      "username": "johndoe"
    },
    "attachments": ["https://s3.amazonaws.com/bucket/file.png"],
    "createdAt": "2023-09-06T10:30:00.000Z"
  }
}
```

#### PUT `/api/messages/[messageId]`
Edit a message (author only).

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "content": "Updated message content"
}
```

#### DELETE `/api/messages/[messageId]`
Delete a message (author or admin only).

**Headers:**
```
Authorization: Bearer <token>
```

### User Endpoints

#### GET `/api/users/me`
Get current user profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "_id": "64f8b123...",
    "username": "johndoe",
    "email": "john@example.com",
    "avatar": "https://s3.amazonaws.com/bucket/avatar.png",
    "status": "online",
    "servers": ["64f8b456...", "64f8b789..."]
  }
}
```

#### PUT `/api/users/me`
Update current user profile.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `username`: New username (optional)
- `status`: New status (online/away/busy/offline) (optional)
- `avatar`: Avatar file (optional)

### Direct Message Endpoints

#### GET `/api/dm`
Get all direct message conversations.

**Headers:**
```
Authorization: Bearer <token>
```

#### GET `/api/dm/[userId]`
Get direct messages with a specific user.

**Headers:**
```
Authorization: Bearer <token>
```

#### POST `/api/dm/[userId]`
Send a direct message to a user.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "content": "Hello there!"
}
```

## ⚡ Socket.io Events

### Connection Events

#### Client → Server: `connection`
Automatically triggered when a client connects with a valid JWT token.

**Authentication:**
```javascript
const socket = io('http://localhost:3001', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

**Server Response:**
- User status updated to online
- User joins all their server rooms
- Connection logged

#### Client → Server: `disconnect`
Automatically triggered when a client disconnects.

**Server Actions:**
- User status updated to offline
- Disconnection logged

### Channel Events

#### Client → Server: `join-channel`
Join a specific channel room for real-time updates.

**Payload:**
```javascript
socket.emit('join-channel', channelId);
```

**Server Response:**
```javascript
socket.emit('channel-joined', { channelId });
```

#### Client → Server: `leave-channel`
Leave a specific channel room.

**Payload:**
```javascript
socket.emit('leave-channel', channelId);
```

**Server Response:**
```javascript
socket.emit('channel-left', { channelId });
```

### Messaging Events

#### Client → Server: `send-message`
Send a real-time message to a channel.

**Payload:**
```javascript
socket.emit('send-message', {
  content: 'Hello everyone!',
  channelId: '64f8b123...',
  serverId: '64f8b456...'
});
```

**Server Response to Channel:**
```javascript
// Broadcasted to all users in the channel
io.to(`channel:${channelId}`).emit('new-message', {
  id: '64f8b789...',
  content: 'Hello everyone!',
  author: {
    _id: '64f8b123...',
    username: 'johndoe',
    avatar: 'https://...',
    status: 'online'
  },
  channel: '64f8b123...',
  server: '64f8b456...',
  createdAt: '2023-09-06T10:30:00.000Z',
  edited: false,
  reactions: []
});
```

#### Client → Server: `edit-message`
Edit an existing message.

**Payload:**
```javascript
socket.emit('edit-message', {
  messageId: '64f8b123...',
  content: 'Updated message content'
});
```

**Server Response to Channel:**
```javascript
io.to(`channel:${channelId}`).emit('message-edited', {
  messageId: '64f8b123...',
  content: 'Updated message content',
  editedAt: '2023-09-06T10:35:00.000Z'
});
```

#### Client → Server: `delete-message`
Delete a message.

**Payload:**
```javascript
socket.emit('delete-message', {
  messageId: '64f8b123...'
});
```

**Server Response to Channel:**
```javascript
io.to(`channel:${channelId}`).emit('message-deleted', {
  messageId: '64f8b123...'
});
```

### Typing Indicators

#### Client → Server: `typing-start`
Indicate that a user started typing.

**Payload:**
```javascript
socket.emit('typing-start', {
  channelId: '64f8b123...'
});
```

**Server Response to Channel:**
```javascript
socket.to(`channel:${channelId}`).emit('user-typing', {
  userId: '64f8b456...',
  username: 'johndoe',
  channelId: '64f8b123...'
});
```

#### Client → Server: `typing-stop`
Indicate that a user stopped typing.

**Payload:**
```javascript
socket.emit('typing-stop', {
  channelId: '64f8b123...'
});
```

**Server Response to Channel:**
```javascript
socket.to(`channel:${channelId}`).emit('user-stopped-typing', {
  userId: '64f8b456...',
  channelId: '64f8b123...'
});
```

### Status Events

#### Client → Server: `update-status`
Update user's online status.

**Payload:**
```javascript
socket.emit('update-status', {
  status: 'away' // online, away, busy, offline
});
```

**Server Response to User's Servers:**
```javascript
// Broadcasted to all servers the user is in
user.servers.forEach(serverId => {
  io.to(`server:${serverId}`).emit('user-status-updated', {
    userId: '64f8b123...',
    status: 'away'
  });
});
```

### Error Events

#### Server → Client: `error`
Error responses for failed operations.

**Server Response:**
```javascript
socket.emit('error', {
  message: 'Error description',
  code: 'ERROR_CODE'
});
```

### Direct Message Events

#### Client → Server: `send-dm`
Send a direct message to another user.

**Payload:**
```javascript
socket.emit('send-dm', {
  recipientId: '64f8b456...',
  content: 'Hello there!'
});
```

**Server Response to Both Users:**
```javascript
io.to(`user:${senderId}`).to(`user:${recipientId}`).emit('new-dm', {
  id: '64f8b789...',
  content: 'Hello there!',
  sender: {
    _id: '64f8b123...',
    username: 'johndoe'
  },
  recipient: '64f8b456...',
  createdAt: '2023-09-06T10:30:00.000Z'
});
```

## 🔐 Authentication

### JWT Token Structure
```javascript
{
  userId: '64f8b123...',
  iat: 1694000000,
  exp: 1694086400 // 24 hours
}
```

### Protected Routes
All API endpoints except authentication routes require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Socket.io Authentication
Socket connections require authentication through the `auth` object:

```javascript
const socket = io('http://localhost:3001', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

## 📁 File Upload

### AWS S3 Integration
Files are uploaded to AWS S3 with the following structure:

```
bucket-name/
├── avatars/
│   └── userId-timestamp.ext
├── attachments/
│   └── channelId/
│       └── messageId-filename.ext
└── server-icons/
    └── serverId-timestamp.ext
```

### Upload Limits
- **Avatar images**: 5MB max, formats: jpg, png, gif
- **Message attachments**: 50MB max per file, 5 files per message
- **Server icons**: 2MB max, formats: jpg, png

### File URLs
All uploaded files return HTTPS URLs:
```
https://your-bucket.s3.region.amazonaws.com/path/to/file.ext
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm run test:all

# Run API tests only
npm run test:comprehensive

# Run Socket.io tests only
npm run test:socket

# Run basic API tests
npm run test
```

### Test Coverage

#### API Tests (`test-comprehensive.js`)
- ✅ User registration and login
- ✅ Server creation and management
- ✅ Channel operations
- ✅ Message sending and editing
- ✅ File upload functionality
- ✅ Authentication middleware
- ✅ Error handling

#### Socket.io Tests (`test-socket.js`)
- ✅ Real-time messaging
- ✅ Typing indicators
- ✅ User status updates
- ✅ Message editing
- ✅ Channel joining/leaving
- ✅ Connection handling

### Test Data Cleanup

```bash
# Clean up test data
npm run cleanup

# Clean up all data (use with caution)
npm run cleanup:all
```

## ❌ Error Handling

### HTTP Status Codes

- **200**: Success
- **201**: Created
- **400**: Bad Request
- **401**: Unauthorized
- **403**: Forbidden
- **404**: Not Found
- **409**: Conflict (e.g., duplicate username)
- **413**: Payload Too Large
- **429**: Too Many Requests
- **500**: Internal Server Error

### Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {} // Additional error details when available
}
```

### Common Error Codes

- `INVALID_CREDENTIALS`: Login failed
- `USER_EXISTS`: Registration with existing email/username
- `TOKEN_EXPIRED`: JWT token has expired
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `FILE_TOO_LARGE`: Uploaded file exceeds size limit
- `INVALID_FILE_TYPE`: Unsupported file format

## 🚀 Deployment

### Environment Setup
1. Set up MongoDB Atlas cluster
2. Configure AWS S3 bucket with proper CORS settings
3. Set up environment variables on your hosting platform
4. Deploy using your preferred platform (Vercel, Heroku, etc.)

### CORS Configuration
The server supports CORS for the specified origin in `SOCKET_CORS_ORIGIN`.

### Database Indexing
Recommended MongoDB indexes for optimal performance:

```javascript
// Users
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ username: 1 }, { unique: true })

// Servers
db.servers.createIndex({ inviteCode: 1 }, { unique: true })
db.servers.createIndex({ owner: 1 })

// Messages
db.messages.createIndex({ channel: 1, createdAt: -1 })
db.messages.createIndex({ author: 1 })

// Channels
db.channels.createIndex({ server: 1 })
```

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review existing GitHub issues
3. Create a new issue with detailed information

---

**Built with ❤️ using Next.js, Socket.io, MongoDB, and AWS S3**
NODE_ENV=development

# Socket.io Configuration
SOCKET_CORS_ORIGIN=http://localhost:3000
```

### 3. MongoDB Setup

Make sure MongoDB is running locally or update the `MONGODB_URI` to point to your MongoDB instance.

### 4. AWS S3 Setup

1. Create an AWS S3 bucket
2. Create an IAM user with S3 permissions
3. Update the AWS credentials in `.env.local`

### 5. Run the Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

### Servers
- `GET /api/servers` - Get user's servers
- `POST /api/servers` - Create a new server

### Channels
- `GET /api/channels/[channelId]` - Get channel details
- `PUT /api/channels/[channelId]` - Update channel
- `DELETE /api/channels/[channelId]` - Delete channel
- `GET /api/channels/[channelId]/messages` - Get channel messages

### File Upload
- `POST /api/upload` - Upload files to S3

## Socket.io Events

### Client to Server
- `join-channel` - Join a channel room
- `leave-channel` - Leave a channel room
- `send-message` - Send a message
- `edit-message` - Edit a message
- `delete-message` - Delete a message
- `typing-start` - Start typing indicator
- `typing-stop` - Stop typing indicator
- `update-status` - Update user status

### Server to Client
- `new-message` - New message received
- `message-edited` - Message was edited
- `message-deleted` - Message was deleted
- `user-typing` - User started typing
- `user-stopped-typing` - User stopped typing
- `user-status-updated` - User status changed

## Database Models

- **User**: User accounts with authentication and profile data
- **Server**: Discord-like servers/guilds
- **Channel**: Text and voice channels within servers
- **Message**: Chat messages with attachments and reactions
- **Role**: Permission-based roles for server members
- **DirectMessage**: Private messaging between users

## Project Structure

```
src/
├── app/api/           # Next.js API routes
├── lib/               # Utility functions (JWT, MongoDB, AWS)
├── middleware/        # Authentication middleware
├── models/           # Mongoose database models
└── socket.js         # Socket.io server implementation
```

## Development

The backend uses a custom server (`server.js`) that combines Next.js with Socket.io for real-time functionality.

## Production Deployment

1. Set `NODE_ENV=production`
2. Update all environment variables for production
3. Build the application: `npm run build`
4. Start the production server: `npm start`

## Next Steps

- Implement file upload with multipart form handling
- Add voice channel functionality with WebRTC
- Implement message search and pagination
- Add friend system and direct messages
- Implement server invites and discovery
- Add admin panel and moderation tools
