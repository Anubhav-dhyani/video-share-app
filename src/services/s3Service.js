const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config');

const s3Client = new S3Client({
  region: config.aws.region,
  credentials: config.aws.credentials,
});

/**
 * Generate a pre-signed URL for uploading a video
 * Uses multipart upload for large files
 */
async function generateUploadUrl(videoId, fileName, contentType, fileSize) {
  const key = `videos/${videoId}/${fileName}`;
  
  const command = new PutObjectCommand({
    Bucket: config.s3.bucketName,
    Key: key,
    ContentType: contentType,
  });

  // URL valid for 1 hour for upload
  const uploadUrl = await getSignedUrl(s3Client, command, { 
    expiresIn: 3600,
  });

  return { uploadUrl, key };
}

/**
 * Generate a one-time pre-signed URL for downloading
 * URL expires in 5-10 minutes
 */
async function generateDownloadUrl(key, fileName) {
  const command = new GetObjectCommand({
    Bucket: config.s3.bucketName,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${fileName}"`,
  });

  // URL valid for 10 minutes
  const downloadUrl = await getSignedUrl(s3Client, command, { 
    expiresIn: config.video.downloadUrlExpiryMinutes * 60,
  });

  return downloadUrl;
}

/**
 * Delete a video from S3
 */
async function deleteVideo(key) {
  const command = new DeleteObjectCommand({
    Bucket: config.s3.bucketName,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Check if video exists in S3
 */
async function videoExists(key) {
  try {
    const command = new HeadObjectCommand({
      Bucket: config.s3.bucketName,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * Get video metadata from S3
 */
async function getVideoMetadata(key) {
  const command = new HeadObjectCommand({
    Bucket: config.s3.bucketName,
    Key: key,
  });
  
  const response = await s3Client.send(command);
  return {
    size: response.ContentLength,
    contentType: response.ContentType,
    lastModified: response.LastModified,
  };
}

module.exports = {
  generateUploadUrl,
  generateDownloadUrl,
  deleteVideo,
  videoExists,
  getVideoMetadata,
};
