const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireAdmin } = require('../middleware/auth');
const s3Service = require('../services/s3Service');
const dynamoService = require('../services/dynamoService');
const config = require('../config');

/**
 * POST /api/videos/upload-url
 * Generate pre-signed upload URL (Admin only)
 */
router.post('/upload-url', requireAdmin, async (req, res) => {
  try {
    const { fileName, contentType, fileSize } = req.body;

    // Validate input
    if (!fileName || !contentType || !fileSize) {
      return res.status(400).json({ error: 'fileName, contentType, and fileSize are required' });
    }

    // Check file size
    if (fileSize > config.video.maxFileSizeBytes) {
      return res.status(400).json({ 
        error: `File size exceeds maximum of ${config.video.maxFileSizeBytes / (1024 * 1024 * 1024)}GB` 
      });
    }

    // Generate video ID
    const videoId = uuidv4();

    // Generate pre-signed upload URL or multipart upload initiation
    const uploadInfo = await s3Service.generateUploadUrl(videoId, fileName, contentType, fileSize);

    // Create video record in DynamoDB
    const video = await dynamoService.createVideo({
      videoId,
      fileName,
      fileSize,
      s3Key: uploadInfo.key,
    });

    // Return different response based on upload type
    const response = {
      videoId,
      video,
      expiresAt: video.expires_at,
      key: uploadInfo.key,
    };

    if (uploadInfo.multipart) {
      // Multipart upload - return uploadId
      response.multipart = true;
      response.uploadId = uploadInfo.uploadId;
      console.log(`📦 Initiated multipart upload for ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      // Direct upload - return pre-signed URL
      response.uploadUrl = uploadInfo.uploadUrl;
      response.multipart = false;
      console.log(`📤 Generated upload URL for ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    }

    res.json(response);
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

/**
 * POST /api/videos/:videoId/confirm-upload
 * Confirm that upload was successful (Admin only)
 */
router.post('/:videoId/confirm-upload', requireAdmin, async (req, res) => {
  try {
    const { videoId } = req.params;

    console.log(`🔍 Confirming upload for video ${videoId}...`);

    const video = await dynamoService.getVideo(videoId);
    if (!video) {
      console.error(`❌ Video ${videoId} not found in DynamoDB`);
      return res.status(404).json({ error: 'Video not found' });
    }

    console.log(`📂 Checking S3 for file: ${video.s3_key}`);

    // Verify file exists in S3 with retry (for multipart upload eventual consistency)
    let exists = false;
    let retries = 5;
    while (retries > 0 && !exists) {
      exists = await s3Service.videoExists(video.s3_key);
      if (!exists) {
        console.log(`⏳ File not found yet in S3, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        retries--;
      }
    }
    
    if (!exists) {
      console.error(`❌ Video file not found in S3 after 5 retries: ${video.s3_key}`);
      return res.status(400).json({ error: 'Video file not found in S3. Upload may have failed.' });
    }

    console.log(`✅ File found in S3! Getting metadata...`);

    // Get actual file metadata from S3
    const metadata = await s3Service.getVideoMetadata(video.s3_key);
    
    console.log(`📊 File size: ${(metadata.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Update DynamoDB with upload confirmation
    await dynamoService.confirmUpload(videoId, metadata.size);

    console.log(`✅ Upload confirmed for video ${videoId}`);

    res.json({
      videoId,
      status: 'uploaded',
      actualSize: metadata.size,
      video,
    });
  } catch (error) {
    console.error(`❌ Error confirming upload:`, error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: `Failed to confirm upload: ${error.message}` });
  }
});

/**
 * POST /api/videos/:videoId/part-url
 * Generate pre-signed URL for a single part (Admin only)
 */
router.post('/:videoId/part-url', requireAdmin, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { uploadId, partNumber, s3Key } = req.body;

    if (!uploadId || !partNumber || !s3Key) {
      return res.status(400).json({ error: 'uploadId, partNumber, and s3Key are required' });
    }

    const uploadUrl = await s3Service.generatePartUploadUrl(s3Key, uploadId, partNumber);

    res.json({ uploadUrl, partNumber });
  } catch (error) {
    console.error('Error generating part URL:', error);
    res.status(500).json({ error: 'Failed to generate part URL' });
  }
});

/**
 * POST /api/videos/:videoId/complete-multipart
 * Complete multipart upload (Admin only)
 */
router.post('/:videoId/complete-multipart', requireAdmin, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { uploadId, parts, s3Key } = req.body;

    console.log(`📦 Completing multipart upload for video ${videoId}: ${parts.length} parts`);

    if (!uploadId || !parts || !s3Key) {
      return res.status(400).json({ error: 'uploadId, parts, and s3Key are required' });
    }

    await s3Service.completeMultipartUpload(s3Key, uploadId, parts);
    
    console.log(`✅ Multipart upload completed successfully for video ${videoId}`);

    res.json({ success: true, message: 'Multipart upload completed' });
  } catch (error) {
    console.error('❌ Error completing multipart upload:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: `Failed to complete multipart upload: ${error.message}` });
  }
});

/**
 * POST /api/videos/:videoId/abort-multipart
 * Abort multipart upload (Admin only)
 */
router.post('/:videoId/abort-multipart', requireAdmin, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { uploadId, s3Key } = req.body;

    if (!uploadId || !s3Key) {
      return res.status(400).json({ error: 'uploadId and s3Key are required' });
    }

    await s3Service.abortMultipartUpload(s3Key, uploadId);

    // Also delete from DynamoDB
    await dynamoService.deleteVideo(videoId);

    res.json({ success: true, message: 'Multipart upload aborted' });
  } catch (error) {
    console.error('Error aborting multipart upload:', error);
    res.status(500).json({ error: 'Failed to abort multipart upload' });
  }
});

/**
 * GET /api/videos
 * List all videos (Admin only)
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const videos = await dynamoService.listAllVideos();
    
    // Add status field for easier frontend handling
    const videosWithStatus = videos.map(video => ({
      ...video,
      status: getVideoStatus(video),
    }));

    res.json({ videos: videosWithStatus });
  } catch (error) {
    console.error('Error listing videos:', error);
    res.status(500).json({ error: 'Failed to list videos' });
  }
});

/**
 * GET /api/videos/:videoId
 * Get video details (Public for download page, more details for admin)
 */
router.get('/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = await dynamoService.getVideo(videoId);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check if video has expired
    if (new Date(video.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Video has expired and is no longer available' });
    }

    // Return public info only
    res.json({
      videoId: video.video_id,
      fileName: video.file_name,
      fileSize: video.file_size,
      isEnabled: video.is_enabled,
      isDownloaded: video.is_downloaded,
      status: getVideoStatus(video),
    });
  } catch (error) {
    console.error('Error getting video:', error);
    res.status(500).json({ error: 'Failed to get video' });
  }
});

/**
 * POST /api/videos/:videoId/download
 * Generate one-time download URL (Public)
 */
router.post('/:videoId/download', async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = await dynamoService.getVideo(videoId);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check if video has expired
    if (new Date(video.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Video has expired and is no longer available' });
    }

    // Check if download is enabled
    if (!video.is_enabled) {
      return res.status(403).json({ 
        error: 'Download is not available',
        reason: video.is_downloaded ? 'already_downloaded' : 'disabled_by_admin'
      });
    }

    // Check if already downloaded
    if (video.is_downloaded) {
      return res.status(403).json({ 
        error: 'This video has already been downloaded',
        reason: 'already_downloaded'
      });
    }

    // Generate pre-signed download URL
    const downloadUrl = await s3Service.generateDownloadUrl(video.s3_key, video.file_name);

    // Mark as downloaded BEFORE returning URL (one-time download)
    await dynamoService.markAsDownloaded(videoId);

    res.json({
      downloadUrl,
      expiresIn: config.video.downloadUrlExpiryMinutes * 60, // seconds
      message: 'Download started. This link will expire in 10 minutes.',
    });
  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

/**
 * PATCH /api/videos/:videoId/toggle
 * Enable or disable download (Admin only)
 */
router.patch('/:videoId/toggle', requireAdmin, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled (boolean) is required' });
    }

    const video = await dynamoService.getVideo(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const updatedVideo = await dynamoService.setDownloadEnabled(videoId, enabled);

    res.json({
      videoId,
      isEnabled: updatedVideo.is_enabled,
      isDownloaded: updatedVideo.is_downloaded,
      status: getVideoStatus(updatedVideo),
      message: enabled ? 'Download re-enabled' : 'Download disabled',
    });
  } catch (error) {
    console.error('Error toggling video:', error);
    res.status(500).json({ error: 'Failed to toggle video' });
  }
});

/**
 * DELETE /api/videos/:videoId
 * Delete video (Admin only)
 */
router.delete('/:videoId', requireAdmin, async (req, res) => {
  try {
    const { videoId } = req.params;

    const video = await dynamoService.getVideo(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Delete from S3
    try {
      await s3Service.deleteVideo(video.s3_key);
    } catch (s3Error) {
      console.error('Error deleting from S3:', s3Error);
      // Continue to delete from DynamoDB even if S3 fails
    }

    // Delete from DynamoDB
    await dynamoService.deleteVideo(videoId);

    res.json({
      videoId,
      message: 'Video deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

/**
 * Helper function to determine video status
 */
function getVideoStatus(video) {
  if (!video.is_enabled && video.is_downloaded) {
    return 'downloaded';
  } else if (!video.is_enabled) {
    return 'disabled';
  } else {
    return 'available';
  }
}

module.exports = router;
