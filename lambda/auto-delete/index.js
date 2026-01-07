/**
 * Lambda function for auto-deleting expired videos
 * Triggered by EventBridge every hour
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION });

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

exports.handler = async (event) => {
  console.log('Starting auto-delete check for expired videos...');
  
  try {
    // Get all expired videos
    const now = new Date().toISOString();
    
    const scanResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'expires_at <= :now',
      ExpressionAttributeValues: {
        ':now': now,
      },
    }));

    const expiredVideos = scanResult.Items || [];
    console.log(`Found ${expiredVideos.length} expired videos to delete`);

    let deletedCount = 0;
    let errors = [];

    for (const video of expiredVideos) {
      try {
        // Delete from S3
        await s3Client.send(new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: video.s3_key,
        }));
        console.log(`Deleted S3 object: ${video.s3_key}`);

        // Delete from DynamoDB
        await docClient.send(new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { video_id: video.video_id },
        }));
        console.log(`Deleted DynamoDB record: ${video.video_id}`);

        deletedCount++;
      } catch (error) {
        console.error(`Error deleting video ${video.video_id}:`, error);
        errors.push({
          videoId: video.video_id,
          error: error.message,
        });
      }
    }

    const result = {
      statusCode: 200,
      body: {
        message: 'Auto-delete completed',
        totalExpired: expiredVideos.length,
        deletedCount,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
      },
    };

    console.log('Auto-delete result:', JSON.stringify(result.body));
    return result;

  } catch (error) {
    console.error('Auto-delete failed:', error);
    return {
      statusCode: 500,
      body: {
        message: 'Auto-delete failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    };
  }
};
