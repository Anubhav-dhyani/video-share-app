# AWS Setup Script for Video Share App (PowerShell)
# Run this script to set up all AWS resources

$ErrorActionPreference = "Stop"

Write-Host "🚀 Video Share App - AWS Setup Script" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# Configuration - CHANGE THESE VALUES
$BUCKET_NAME = "video-share-bucket-$(Get-Date -Format 'yyyyMMddHHmmss')"
$REGION = "us-east-1"
$ADMIN_EMAIL = "your-email@example.com"
$STACK_NAME = "video-share-stack"

Write-Host ""
Write-Host "📋 Configuration:" -ForegroundColor Yellow
Write-Host "   Bucket Name: $BUCKET_NAME"
Write-Host "   Region: $REGION"
Write-Host "   Admin Email: $ADMIN_EMAIL"
Write-Host ""

$confirm = Read-Host "Do you want to proceed? (y/n)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    exit
}

# Check AWS CLI is installed
try {
    aws --version | Out-Null
} catch {
    Write-Host "❌ AWS CLI is not installed. Please install it first." -ForegroundColor Red
    exit 1
}

# Check AWS credentials are configured
try {
    aws sts get-caller-identity | Out-Null
} catch {
    Write-Host "❌ AWS credentials are not configured. Run 'aws configure' first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "1️⃣ Deploying CloudFormation stack..." -ForegroundColor Green
aws cloudformation deploy `
    --template-file aws/cloudformation-template.json `
    --stack-name $STACK_NAME `
    --parameter-overrides BucketName=$BUCKET_NAME AdminEmail=$ADMIN_EMAIL `
    --capabilities CAPABILITY_NAMED_IAM `
    --region $REGION

Write-Host ""
Write-Host "2️⃣ Waiting for stack to complete..." -ForegroundColor Green
aws cloudformation wait stack-create-complete --stack-name $STACK_NAME --region $REGION 2>$null

Write-Host ""
Write-Host "3️⃣ Getting stack outputs..." -ForegroundColor Green
$OUTPUTS = aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].Outputs'
Write-Host $OUTPUTS

Write-Host ""
Write-Host "4️⃣ Installing Lambda dependencies..." -ForegroundColor Green
Push-Location lambda/auto-delete
npm install --production
Pop-Location

Write-Host ""
Write-Host "5️⃣ Packaging Lambda function..." -ForegroundColor Green
Push-Location lambda/auto-delete
Compress-Archive -Path * -DestinationPath ../auto-delete.zip -Force
Pop-Location

Write-Host ""
Write-Host "6️⃣ Deploying Lambda code..." -ForegroundColor Green
aws lambda update-function-code `
    --function-name video-auto-delete `
    --zip-file fileb://lambda/auto-delete.zip `
    --region $REGION

Write-Host ""
Write-Host "7️⃣ Creating IAM access keys for backend..." -ForegroundColor Green
$ACCESS_KEY = aws iam create-access-key --user-name video-share-backend-user --query 'AccessKey' --output json

Write-Host ""
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "📝 Add these to your .env file:" -ForegroundColor Yellow
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "AWS_REGION=$REGION"
Write-Host "S3_BUCKET_NAME=$BUCKET_NAME"
Write-Host "DYNAMODB_TABLE_NAME=video-share-videos"
Write-Host ""
Write-Host "AWS Access Key (save this!):" -ForegroundColor Yellow
Write-Host $ACCESS_KEY
Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  IMPORTANT: Check your email to confirm the billing alert subscription!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "1. Copy the access key above to your .env file"
Write-Host "2. Generate password hash: npm start, then POST to /api/auth/hash-password"
Write-Host "3. Add the hash to ADMIN_PASSWORD_HASH in .env"
Write-Host "4. Run the app: npm start"
