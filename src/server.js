require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

// Import routes
const authRoutes = require('./routes/auth');
const videoRoutes = require('./routes/videos');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
  });
});

// Serve frontend for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: config.server.nodeEnv === 'development' ? err.message : undefined,
  });
});

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Environment: ${config.server.nodeEnv}`);
  console.log(`🪣 S3 Bucket: ${config.s3.bucketName}`);
  console.log(`📊 DynamoDB Table: ${config.dynamodb.tableName}`);
});
