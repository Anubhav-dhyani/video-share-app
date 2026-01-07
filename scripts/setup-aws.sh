#!/bin/bash
# AWS Setup Script for Video Share App
# Run this script to set up all AWS resources

set -e

echo "🚀 Video Share App - AWS Setup Script"
echo "======================================="

# Configuration - CHANGE THESE VALUES
BUCKET_NAME="video-share-bucket-$(date +%s)"
REGION="us-east-1"
ADMIN_EMAIL="your-email@example.com"
STACK_NAME="video-share-stack"

echo ""
echo "📋 Configuration:"
echo "   Bucket Name: $BUCKET_NAME"
echo "   Region: $REGION"
echo "   Admin Email: $ADMIN_EMAIL"
echo ""

read -p "Do you want to proceed? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Check AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials are not configured. Run 'aws configure' first."
    exit 1
fi

echo ""
echo "1️⃣ Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file aws/cloudformation-template.json \
    --stack-name $STACK_NAME \
    --parameter-overrides BucketName=$BUCKET_NAME AdminEmail=$ADMIN_EMAIL \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION

echo ""
echo "2️⃣ Waiting for stack to complete..."
aws cloudformation wait stack-create-complete --stack-name $STACK_NAME --region $REGION 2>/dev/null || true

echo ""
echo "3️⃣ Getting stack outputs..."
OUTPUTS=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].Outputs')
echo "$OUTPUTS"

echo ""
echo "4️⃣ Installing Lambda dependencies..."
cd lambda/auto-delete
npm install --production
cd ../..

echo ""
echo "5️⃣ Packaging Lambda function..."
cd lambda/auto-delete
zip -r ../auto-delete.zip .
cd ../..

echo ""
echo "6️⃣ Deploying Lambda code..."
aws lambda update-function-code \
    --function-name video-auto-delete \
    --zip-file fileb://lambda/auto-delete.zip \
    --region $REGION

echo ""
echo "7️⃣ Creating IAM access keys for backend..."
ACCESS_KEY=$(aws iam create-access-key --user-name video-share-backend-user --query 'AccessKey' --output json)

echo ""
echo "✅ Setup Complete!"
echo ""
echo "======================================="
echo "📝 Add these to your .env file:"
echo "======================================="
echo ""
echo "AWS_REGION=$REGION"
echo "S3_BUCKET_NAME=$BUCKET_NAME"
echo "DYNAMODB_TABLE_NAME=video-share-videos"
echo ""
echo "AWS Access Key (save this!):"
echo "$ACCESS_KEY"
echo ""
echo "======================================="
echo ""
echo "⚠️  IMPORTANT: Check your email to confirm the billing alert subscription!"
echo ""
echo "Next steps:"
echo "1. Copy the access key above to your .env file"
echo "2. Generate password hash: npm run start, then POST to /api/auth/hash-password"
echo "3. Add the hash to ADMIN_PASSWORD_HASH in .env"
echo "4. Run the app: npm start"
