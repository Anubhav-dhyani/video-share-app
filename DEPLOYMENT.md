# ============================================
# VIDEO SHARE APP - COMPLETE DEPLOYMENT GUIDE
# ============================================

## QUICK OVERVIEW

You need to deploy:
1. AWS S3 Bucket (video storage)
2. AWS DynamoDB Table (metadata)
3. AWS Lambda (auto-delete - optional but recommended)
4. Backend Server (Render, Railway, or locally)

---

## STEP 1: AWS SETUP (Required - 10 minutes)

### 1.1 Create S3 Bucket

```bash
# Run in terminal (replace YOUR-UNIQUE-BUCKET-NAME)
aws s3 mb s3://YOUR-UNIQUE-BUCKET-NAME --region us-east-1

# Block all public access
aws s3api put-public-access-block \
    --bucket YOUR-UNIQUE-BUCKET-NAME \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enable CORS for uploads
aws s3api put-bucket-cors --bucket YOUR-UNIQUE-BUCKET-NAME --cors-configuration '{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": ["*"],
    "MaxAgeSeconds": 3600
  }]
}'
```

### 1.2 Create DynamoDB Table

```bash
aws dynamodb create-table \
    --table-name video-share-videos \
    --attribute-definitions AttributeName=video_id,AttributeType=S \
    --key-schema AttributeName=video_id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region us-east-1
```

### 1.3 Create IAM User for Backend

1. Go to AWS Console → IAM → Users → Create User
2. Name: `video-share-backend`
3. Attach policy (create custom policy):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:HeadObject"],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Scan"],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/video-share-videos"
    }
  ]
}
```

4. Create Access Key → Save the Access Key ID and Secret!

---

## STEP 2: GENERATE PASSWORD HASH

```bash
cd c:\video-share-app
node scripts/generate-password-hash.js YourSecurePassword123!
```

Copy the hash output - you'll need it for ADMIN_PASSWORD_HASH

---

## STEP 3: DEPLOY ON RENDER (Free Tier Available)

### 3.1 Push to GitHub

```bash
cd c:\video-share-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/video-share-app.git
git push -u origin main
```

### 3.2 Deploy on Render

1. Go to https://render.com and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Configure:
   - **Name**: video-share-app
   - **Region**: Oregon (US West) or closest to you
   - **Branch**: main
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (or Starter $7/mo for always-on)

### 3.3 Add Environment Variables in Render

Go to your service → Environment → Add these:

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-from-step-1.3
AWS_SECRET_ACCESS_KEY=your-secret-key-from-step-1.3
S3_BUCKET_NAME=your-bucket-name
DYNAMODB_TABLE_NAME=video-share-videos
ADMIN_EMAIL=your-email@example.com
ADMIN_PASSWORD_HASH=paste-hash-from-step-2
JWT_SECRET=generate-a-random-32-character-string
PORT=3000
NODE_ENV=production
VIDEO_EXPIRY_HOURS=15
DOWNLOAD_URL_EXPIRY_MINUTES=10
MAX_FILE_SIZE_GB=20
```

### 3.4 Deploy!

Click "Create Web Service" - Render will build and deploy automatically.

Your app will be live at: `https://video-share-app.onrender.com`

---

## STEP 4: SET UP AUTO-DELETE LAMBDA (Optional but Recommended)

### 4.1 Create Lambda Function

1. Go to AWS Console → Lambda → Create Function
2. Name: `video-auto-delete`
3. Runtime: Node.js 18.x
4. Create function

### 4.2 Deploy Lambda Code

```bash
cd c:\video-share-app\lambda\auto-delete
npm install
# Create zip file (use 7-Zip or PowerShell)
Compress-Archive -Path * -DestinationPath auto-delete.zip

# Upload via AWS CLI
aws lambda update-function-code --function-name video-auto-delete --zip-file fileb://auto-delete.zip
```

### 4.3 Add Environment Variables to Lambda

In AWS Console → Lambda → Configuration → Environment Variables:
- `S3_BUCKET_NAME`: your-bucket-name
- `DYNAMODB_TABLE_NAME`: video-share-videos

### 4.4 Add Lambda Permissions

Attach this policy to Lambda's execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:Scan", "dynamodb:DeleteItem"],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/video-share-videos"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:DeleteObject"],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

### 4.5 Create EventBridge Schedule

1. Go to AWS Console → EventBridge → Rules → Create Rule
2. Name: `video-auto-delete-hourly`
3. Schedule: `rate(1 hour)`
4. Target: Lambda function → video-auto-delete
5. Create

---

## STEP 5: SET UP BILLING ALERTS

1. Go to AWS Console → Billing → Budgets
2. Create Budget → Cost Budget
3. Budget: $15/month
4. Add alerts at $10.50 (70%) and $13.50 (90%)
5. Add your email for notifications

---

## ALTERNATIVE: RUN LOCALLY (For Testing)

```bash
cd c:\video-share-app

# 1. Create .env file
copy .env.example .env

# 2. Edit .env with your values (use notepad or VS Code)
notepad .env

# 3. Start the server
npm run dev

# 4. Open browser
# http://localhost:3000
```

---

## HOW TO USE THE APP

### Admin Panel
1. Go to your app URL (e.g., https://video-share-app.onrender.com)
2. Login with your admin email and password
3. Upload videos (drag & drop or click to browse)
4. Copy the share link to send to users
5. Monitor download status
6. Enable/disable downloads as needed

### User Download
1. User opens the shared link (e.g., https://your-app.com/download/abc-123)
2. Clicks "Download Now"
3. Download starts immediately
4. Button becomes disabled (one-time download)

---

## COST SUMMARY

| Service | Monthly Cost |
|---------|--------------|
| Render (Free tier) | $0 |
| S3 (50GB storage) | ~$1.15 |
| S3 (100GB transfer) | ~$9.00 |
| DynamoDB (on-demand) | ~$0.50 |
| Lambda (720 calls) | ~$0.01 |
| **TOTAL** | **~$10.66** |

✅ Well under your $15/month budget!

---

## TROUBLESHOOTING

### "Access Denied" errors
- Check AWS credentials in environment variables
- Verify IAM policy has correct bucket name

### Upload fails
- Check S3 CORS configuration
- Verify bucket name is correct

### Login not working
- Regenerate password hash
- Check ADMIN_EMAIL matches exactly

### Lambda not deleting
- Check Lambda has correct IAM permissions
- Verify EventBridge rule is enabled
