require('dotenv').config();

module.exports = {
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },
  s3: {
    bucketName: process.env.S3_BUCKET_NAME,
  },
  dynamodb: {
    tableName: process.env.DYNAMODB_TABLE_NAME || 'video-share-videos',
  },
  admin: {
    email: process.env.ADMIN_EMAIL,
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '24h',
  },
  video: {
    expiryHours: parseInt(process.env.VIDEO_EXPIRY_HOURS) || 15,
    downloadUrlExpiryMinutes: parseInt(process.env.DOWNLOAD_URL_EXPIRY_MINUTES) || 10,
    maxFileSizeBytes: (parseInt(process.env.MAX_FILE_SIZE_GB) || 20) * 1024 * 1024 * 1024,
  },
  server: {
    port: parseInt(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },
};
