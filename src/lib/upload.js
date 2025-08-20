const AWS = require('aws-sdk');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// File type validation
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'text/plain',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed'
];

// File size limits (in bytes)
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Upload a file to S3
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File MIME type
 * @param {string} folder - S3 folder (avatars, attachments, server-icons)
 * @param {string} [customName] - Custom file name (optional)
 * @returns {Promise<string>} S3 URL
 */
async function uploadToS3(fileBuffer, fileName, mimeType, folder, customName = null) {
  try {
    // Generate unique file name
    const fileExtension = path.extname(fileName);
    const uniqueName = customName || `${uuidv4()}${fileExtension}`;
    const key = `${folder}/${uniqueName}`;

    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType
      // Removed ACL since the bucket doesn't support ACLs
    };

    const result = await s3.upload(uploadParams).promise();
    return result.Location;
  } catch (error) {
    console.error('S3 Upload Error:', error);
    throw new Error('Failed to upload file to S3');
  }
}

/**
 * Delete a file from S3
 * @param {string} fileUrl - S3 file URL
 * @returns {Promise<void>}
 */
async function deleteFromS3(fileUrl) {
  try {
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1); // Remove leading slash

    const deleteParams = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key
    };

    await s3.deleteObject(deleteParams).promise();
  } catch (error) {
    console.error('S3 Delete Error:', error);
    throw new Error('Failed to delete file from S3');
  }
}

/**
 * Validate file type
 * @param {string} mimeType - File MIME type
 * @param {string} fileType - Type validation ('image' or 'any')
 * @returns {boolean}
 */
function validateFileType(mimeType, fileType = 'any') {
  if (fileType === 'image') {
    return ALLOWED_IMAGE_TYPES.includes(mimeType);
  }
  return ALLOWED_FILE_TYPES.includes(mimeType);
}

/**
 * Validate file size
 * @param {number} fileSize - File size in bytes
 * @param {string} fileType - Type for size limit ('avatar' or 'attachment')
 * @returns {boolean}
 */
function validateFileSize(fileSize, fileType = 'attachment') {
  if (fileType === 'avatar') {
    return fileSize <= MAX_AVATAR_SIZE;
  }
  return fileSize <= MAX_ATTACHMENT_SIZE;
}

/**
 * Process multipart form data for file uploads
 * @param {Request} request - Next.js request object
 * @returns {Promise<{fields: Object, files: Array}>}
 */
async function parseMultipartData(request) {
  const formData = await request.formData();
  const fields = {};
  const files = [];

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const buffer = await value.arrayBuffer();
      files.push({
        fieldName: key,
        originalName: value.name,
        mimeType: value.type,
        size: value.size,
        buffer: Buffer.from(buffer)
      });
    } else {
      fields[key] = value;
    }
  }

  return { fields, files };
}

/**
 * Upload avatar image
 * @param {File} file - File object
 * @param {string} userId - User ID for naming
 * @returns {Promise<string>} S3 URL
 */
async function uploadAvatar(file, userId) {
  // Validate file type
  if (!validateFileType(file.mimeType, 'image')) {
    throw new Error('Invalid file type. Only images are allowed for avatars.');
  }

  // Validate file size
  if (!validateFileSize(file.size, 'avatar')) {
    throw new Error('File too large. Avatar images must be under 5MB.');
  }

  // Upload to S3
  const customName = `${userId}-${Date.now()}${path.extname(file.originalName)}`;
  return await uploadToS3(file.buffer, file.originalName, file.mimeType, 'avatars', customName);
}

/**
 * Upload message attachments
 * @param {Array} files - Array of file objects
 * @param {string} channelId - Channel ID for folder organization
 * @param {string} messageId - Message ID for naming
 * @returns {Promise<Array>} Array of S3 URLs
 */
async function uploadAttachments(files, channelId, messageId) {
  const uploadPromises = files.map(async (file, index) => {
    // Validate file type
    if (!validateFileType(file.mimeType)) {
      throw new Error(`Invalid file type: ${file.originalName}`);
    }

    // Validate file size
    if (!validateFileSize(file.size)) {
      throw new Error(`File too large: ${file.originalName}. Max size is 50MB.`);
    }

    // Upload to S3
    const folder = `attachments/${channelId}`;
    const customName = `${messageId}-${index}-${file.originalName}`;
    return await uploadToS3(file.buffer, file.originalName, file.mimeType, folder, customName);
  });

  return await Promise.all(uploadPromises);
}

/**
 * Upload server icon
 * @param {File} file - File object
 * @param {string} serverId - Server ID for naming
 * @returns {Promise<string>} S3 URL
 */
async function uploadServerIcon(file, serverId) {
  // Validate file type
  if (!validateFileType(file.mimeType, 'image')) {
    throw new Error('Invalid file type. Only images are allowed for server icons.');
  }

  // Validate file size (using avatar size limit for server icons)
  if (!validateFileSize(file.size, 'avatar')) {
    throw new Error('File too large. Server icons must be under 5MB.');
  }

  // Upload to S3
  const customName = `${serverId}-${Date.now()}${path.extname(file.originalName)}`;
  return await uploadToS3(file.buffer, file.originalName, file.mimeType, 'server-icons', customName);
}

module.exports = {
  uploadToS3,
  deleteFromS3,
  validateFileType,
  validateFileSize,
  parseMultipartData,
  uploadAvatar,
  uploadAttachments,
  uploadServerIcon,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_FILE_TYPES,
  MAX_AVATAR_SIZE,
  MAX_ATTACHMENT_SIZE
};
