const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const config = require('../config');

const client = new DynamoDBClient({
  region: config.aws.region,
  credentials: config.aws.credentials,
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = config.dynamodb.tableName;

/**
 * Create a new video record
 */
async function createVideo(videoData) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.video.expiryHours * 60 * 60 * 1000);
  
  const item = {
    video_id: videoData.videoId,
    file_name: videoData.fileName,
    file_size: videoData.fileSize,
    s3_key: videoData.s3Key,
    is_downloaded: false,
    is_enabled: true,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    ttl: Math.floor(expiresAt.getTime() / 1000), // TTL for DynamoDB auto-delete
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));

  return item;
}

/**
 * Get video by ID
 */
async function getVideo(videoId) {
  const response = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { video_id: videoId },
  }));

  return response.Item;
}

/**
 * Update video download status
 */
async function markAsDownloaded(videoId) {
  const response = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { video_id: videoId },
    UpdateExpression: 'SET is_downloaded = :downloaded, is_enabled = :enabled, downloaded_at = :downloadedAt',
    ExpressionAttributeValues: {
      ':downloaded': true,
      ':enabled': false,
      ':downloadedAt': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  }));

  return response.Attributes;
}

/**
 * Enable or disable download button
 */
async function setDownloadEnabled(videoId, isEnabled) {
  const response = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { video_id: videoId },
    UpdateExpression: 'SET is_enabled = :enabled, is_downloaded = :downloaded',
    ExpressionAttributeValues: {
      ':enabled': isEnabled,
      ':downloaded': !isEnabled, // Reset downloaded status when re-enabling
    },
    ReturnValues: 'ALL_NEW',
  }));

  return response.Attributes;
}

/**
 * Delete video record
 */
async function deleteVideo(videoId) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { video_id: videoId },
  }));
}

/**
 * List all videos (for admin)
 */
async function listAllVideos() {
  const response = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
  }));

  return response.Items || [];
}

/**
 * Get all expired videos
 */
async function getExpiredVideos() {
  const now = new Date().toISOString();
  
  const response = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'expires_at <= :now',
    ExpressionAttributeValues: {
      ':now': now,
    },
  }));

  return response.Items || [];
}

module.exports = {
  createVideo,
  getVideo,
  markAsDownloaded,
  setDownloadEnabled,
  deleteVideo,
  listAllVideos,
  getExpiredVideos,
};
