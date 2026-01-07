# Video Share App - Cost-Optimized One-Time Download Solution

A secure, cost-optimized video sharing application with one-time download functionality, designed to stay under $15/month on AWS.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VIDEO SHARE APP                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐         ┌──────────────────┐         ┌────────────────┐ │
│   │   Browser    │◄───────►│  Node.js/Express │◄───────►│   DynamoDB     │ │
│   │  (Frontend)  │         │    (Backend)     │         │  (Metadata)    │ │
│   └──────────────┘         └────────┬─────────┘         └────────────────┘ │
│          │                          │                                       │
│          │ Pre-signed URLs          │                                       │
│          ▼                          ▼                                       │
│   ┌─────────────────────────────────────────┐                               │
│   │              AWS S3 (Private)            │                               │
│   │         [Videos stored here]             │                               │
│   └─────────────────────────────────────────┘                               │
│                       ▲                                                      │
│                       │ Delete expired                                       │
│   ┌───────────────────┴──────────────────┐                                  │
│   │     Lambda + EventBridge (Hourly)     │                                  │
│   │        [Auto-delete at 15hrs]         │                                  │
│   └───────────────────────────────────────┘                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔐 Security Design

### No Public S3 Access
- S3 bucket has **all public access blocked**
- Server-side encryption (AES-256) enabled
- All access via pre-signed URLs only
- HTTPS-only access enforced

### Pre-signed URL Security
- **Upload URLs**: Valid for 1 hour, admin-only generation
- **Download URLs**: Valid for 10 minutes, one-time use
- URLs are cryptographically signed by AWS

### Authentication
- Admin: JWT-based authentication with bcrypt password hashing
- Users: No login required (download via shared link)

## 📁 Project Structure

```
video-share-app/
├── src/
│   ├── server.js              # Express server entry point
│   ├── config/
│   │   └── index.js           # Configuration management
│   ├── services/
│   │   ├── s3Service.js       # S3 operations (pre-signed URLs)
│   │   ├── dynamoService.js   # DynamoDB operations
│   │   └── authService.js     # JWT authentication
│   ├── middleware/
│   │   └── auth.js            # Auth middleware
│   └── routes/
│       ├── auth.js            # Login endpoints
│       └── videos.js          # Video CRUD endpoints
├── public/
│   └── index.html             # Single-page frontend
├── lambda/
│   └── auto-delete/
│       ├── index.js           # Auto-delete Lambda function
│       └── package.json
├── aws/
│   ├── cloudformation-template.json  # Full AWS infrastructure
│   ├── backend-iam-policy.json       # Backend IAM policy
│   ├── lambda-iam-policy.json        # Lambda IAM policy
│   └── s3-bucket-policy.json         # S3 bucket policy
├── scripts/
│   ├── setup-aws.sh           # AWS setup (Linux/Mac)
│   ├── setup-aws.ps1          # AWS setup (Windows)
│   └── generate-password-hash.js
├── package.json
├── .env.example
└── README.md
```

## 🚀 API Routes

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/login` | Admin login | Public |
| GET | `/api/auth/verify` | Verify JWT token | Bearer Token |
| POST | `/api/auth/hash-password` | Generate password hash (dev only) | Public |

### Videos

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/videos/upload-url` | Get pre-signed upload URL | Admin |
| POST | `/api/videos/:id/confirm-upload` | Confirm upload complete | Admin |
| GET | `/api/videos` | List all videos | Admin |
| GET | `/api/videos/:id` | Get video details | Public |
| POST | `/api/videos/:id/download` | Get one-time download URL | Public |
| PATCH | `/api/videos/:id/toggle` | Enable/disable download | Admin |
| DELETE | `/api/videos/:id` | Delete video | Admin |

## 💾 DynamoDB Schema

**Table: `video-share-videos`**

| Attribute | Type | Description |
|-----------|------|-------------|
| `video_id` | String (PK) | UUID for the video |
| `file_name` | String | Original filename |
| `file_size` | Number | File size in bytes |
| `s3_key` | String | S3 object key |
| `is_downloaded` | Boolean | Has been downloaded |
| `is_enabled` | Boolean | Download button enabled |
| `created_at` | String (ISO) | Upload timestamp |
| `expires_at` | String (ISO) | Auto-delete timestamp |
| `ttl` | Number | TTL for auto-cleanup |

## ⚡ Lambda Auto-Delete Logic

The Lambda function runs every hour via EventBridge and:

1. Scans DynamoDB for videos where `expires_at <= now`
2. Deletes each expired video from S3
3. Removes the DynamoDB record
4. Logs results to CloudWatch

```javascript
// Trigger: EventBridge rate(1 hour)
// Logic:
// - Scan for expired videos
// - Delete from S3
// - Delete from DynamoDB
// - Log results
```

## 🎨 Frontend Button Disable Logic

```javascript
// On download click:
async function downloadVideo() {
  // 1. Request one-time download URL
  const response = await fetch(`/api/videos/${videoId}/download`, { method: 'POST' });
  
  // 2. Backend marks video as downloaded BEFORE returning URL
  // 3. Start download
  window.location.href = response.downloadUrl;
  
  // 4. Disable button permanently
  document.getElementById('downloadBtn').disabled = true;
  showMessage('Download started. This was a one-time download.');
}

// On page load - check status:
if (!video.isEnabled || video.isDownloaded) {
  disableDownloadButton();
  showMessage('Already downloaded or disabled by admin');
}
```

## 💰 Cost Analysis (Staying Under $15/month)

### AWS Services Used

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| **S3 Storage** | ~50GB average | ~$1.15 |
| **S3 Requests** | ~1000 PUT/GET | ~$0.01 |
| **S3 Data Transfer** | ~100GB out | ~$9.00 |
| **DynamoDB** | On-demand, ~1000 ops | ~$0.50 |
| **Lambda** | 720 invocations (hourly) | ~$0.01 |
| **EventBridge** | 720 events | Free |
| **CloudWatch** | Logs + Alarms | ~$0.50 |
| **SNS** | Billing alerts | Free tier |
| | **TOTAL** | **~$11.17** |

### Cost Optimization Strategies

1. **No CloudFront** - Direct S3 pre-signed URLs (saves $10+/month)
2. **No video streaming** - Download only (saves bandwidth)
3. **Intelligent Tiering** - Automatic storage class optimization
4. **15-hour auto-delete** - Minimizes storage time
5. **DynamoDB on-demand** - Pay only for what you use
6. **Lambda 128MB** - Minimum memory for simple operations
7. **Single region** - No cross-region replication

### Billing Alerts

- **70% Alert** ($10.50): Warning notification
- **90% Alert** ($13.50): Urgent notification

## 🔧 Setup Instructions

### Prerequisites

- Node.js 18+
- AWS CLI configured with credentials
- AWS account with IAM permissions

### 1. Clone and Install

```bash
cd video-share-app
npm install
```

### 2. Configure AWS

```bash
# Windows
.\scripts\setup-aws.ps1

# Linux/Mac
chmod +x scripts/setup-aws.sh
./scripts/setup-aws.sh
```

### 3. Generate Password Hash

```bash
node scripts/generate-password-hash.js YOUR_SECURE_PASSWORD
```

### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values from setup script
```

### 5. Start the Server

```bash
# Development
npm run dev

# Production
npm start
```

### 6. Access the App

- Admin Panel: `http://localhost:3000`
- Download Link: `http://localhost:3000/download/{video_id}`

## 🛡️ IAM Policies

### Backend Application Policy

```json
{
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:HeadObject"],
      "Resource": "arn:aws:s3:::BUCKET/videos/*"
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Scan"],
      "Resource": "arn:aws:dynamodb:REGION:ACCOUNT:table/video-share-videos"
    }
  ]
}
```

### Lambda Policy (Auto-Delete)

```json
{
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:Scan", "dynamodb:DeleteItem"],
      "Resource": "arn:aws:dynamodb:REGION:ACCOUNT:table/video-share-videos"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:DeleteObject"],
      "Resource": "arn:aws:s3:::BUCKET/videos/*"
    }
  ]
}
```

## ⚙️ Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | IAM access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key | `xxx...` |
| `S3_BUCKET_NAME` | S3 bucket name | `video-share-bucket-123` |
| `DYNAMODB_TABLE_NAME` | DynamoDB table | `video-share-videos` |
| `ADMIN_EMAIL` | Admin login email | `admin@example.com` |
| `ADMIN_PASSWORD_HASH` | bcrypt hash | `$2a$10$...` |
| `JWT_SECRET` | JWT signing secret | Random string |
| `PORT` | Server port | `3000` |
| `VIDEO_EXPIRY_HOURS` | Auto-delete time | `15` |

## 🚫 What This App Does NOT Do

- ❌ No video previews (saves bandwidth)
- ❌ No streaming (download only)
- ❌ No CloudFront (unnecessary cost)
- ❌ No public S3 access (security)
- ❌ No user registration (admin only)
- ❌ No multiple simultaneous downloads

## ✅ Checklist

- [x] Private S3 bucket with encryption
- [x] Pre-signed upload URLs (admin)
- [x] Pre-signed download URLs (one-time)
- [x] DynamoDB for metadata
- [x] Lambda + EventBridge for auto-delete
- [x] JWT admin authentication
- [x] Single-page frontend
- [x] Billing alerts (70%, 90%)
- [x] $15/month budget design

## 📝 License

MIT License
