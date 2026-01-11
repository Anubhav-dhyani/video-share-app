const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config');

const s3Client = new S3Client({
  region: config.aws.region,
  credentials: config.aws.credentials,
});

/**
 * Generate a pre-signed URL for uploading a video (for small files)
 * Uses multipart upload for large files
 */
async function generateUploadUrl(videoId, fileName, contentType, fileSize) {
  const key = `videos/${videoId}/${fileName}`;
  
  // For files larger than 100MB, use multipart upload
  if (fileSize > 100 * 1024 * 1024) {
    return await initiateMultipartUpload(key, contentType, videoId);
  }
  
  const command = new PutObjectCommand({
    Bucket: config.s3.bucketName,
    Key: key,
    ContentType: contentType,
  });

  // URL valid for 1 hour for upload
  const uploadUrl = await getSignedUrl(s3Client, command, { 
    expiresIn: 3600,
  });

  return { uploadUrl, key, multipart: false };
}

/**
 * Initiate multipart upload for large files
 */
async function initiateMultipartUpload(key, contentType, videoId) {
  const command = new CreateMultipartUploadCommand({
    Bucket: config.s3.bucketName,
    Key: key,
    ContentType: contentType,
  });

  const response = await s3Client.send(command);
  
  return {
    key,
    uploadId: response.UploadId,
    multipart: true,
  };
}

/**
 * Generate pre-signed URL for uploading a single part
 */
async function generatePartUploadUrl(key, uploadId, partNumber) {
  const command = new UploadPartCommand({
    Bucket: config.s3.bucketName,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour
  });

  return uploadUrl;
}

/**
 * Complete multipart upload
 */
async function completeMultipartUpload(key, uploadId, parts) {
  const command = new CompleteMultipartUploadCommand({
    Bucket: config.s3.bucketName,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts,
    },
  });

  await s3Client.send(command);
}

/**
 * Abort multipart upload
 */
async function abortMultipartUpload(key, uploadId) {
  const command = new AbortMultipartUploadCommand({
    Bucket: config.s3.bucketName,
    Key: key,
    UploadId: uploadId,
  });

  await s3Client.send(command);
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
  generatePartUploadUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  generateDownloadUrl,
  deleteVideo,
  videoExists,
  getVideoMetadata,
};
