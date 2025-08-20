const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// File filter function
const fileFilter = (req, file, cb) => {
  // Allow images and common file types
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp4|mp3|wav/;
  const extname = allowedTypes.test(file.originalname.toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, documents, and media files are allowed.'));
  }
};

// Multer S3 upload configuration
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    acl: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const folder = req.uploadFolder || 'general';
      const filename = `${folder}/${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
      cb(null, filename);
    }
  }),
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Function to delete file from S3
const deleteFromS3 = async (fileKey) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileKey
    };
    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    return false;
  }
};

module.exports = {
  s3,
  upload,
  deleteFromS3
};
