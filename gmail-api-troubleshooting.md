# Gmail API Troubleshooting Guide

## Current Issue
Getting "Precondition check failed" (status 400) when trying to access Gmail API, even without domain impersonation.

## Root Cause Analysis
This error typically means one of these issues:

### 1. Gmail API Not Properly Enabled
**Check in Google Cloud Console:**
1. Go to https://console.cloud.google.com/
2. Select project "superheroboardv2"
3. Navigate to "APIs & Services" > "Library"
4. Search for "Gmail API"
5. Make sure it shows "ENABLED" (not just "API enabled")
6. If not enabled, click "ENABLE"

### 2. Service Account Permissions Issue
**Check Service Account Setup:**
1. Go to "IAM & Admin" > "Service Accounts"
2. Find your service account (client ID: 117706433447438028506)
3. Make sure it has appropriate roles:
   - Gmail API User (if available)
   - Or at minimum: Editor/Viewer role

### 3. Domain-Wide Delegation Configuration
**For Google Workspace (ecoship.com / higleyenterprises.com):**

#### Step 1: Enable Domain-Wide Delegation
1. In Google Cloud Console > IAM & Admin > Service Accounts
2. Click on your service account
3. Go to "Advanced settings" or "Domain-wide delegation"
4. Check "Enable Google Workspace Domain-wide Delegation"
5. Save the changes

#### Step 2: Configure in Google Workspace Admin
1. Go to https://admin.google.com/
2. Navigate to Security > API Controls > Domain-wide delegation
3. Add new delegation with:
   - **Client ID:** 117706433447438028506
   - **OAuth Scopes:** https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/gmail.modify
4. Click "Authorize"

### 4. User-Specific Gmail Issues
Some users might not have Gmail properly enabled:

1. In Google Workspace Admin Console
2. Go to Users > Select user
3. Check if Gmail service is enabled for that user
4. Apps > Google Workspace > Gmail > "Service status" should be "ON"

## Quick Fix Steps

### Step 1: Re-enable Gmail API
```bash
# Run this to check current API status
node check-apis.js
```

### Step 2: Test with Broader Scopes
```bash
# Test with comprehensive scopes
node test-all-scopes.js
```

### Step 3: Test Specific Users
```bash
# Test different users systematically
node test-comprehensive.js
```

## If Still Failing

### Check Project Quotas
1. Google Cloud Console > APIs & Services > Quotas
2. Search for "Gmail API"
3. Make sure you have available quota

### Check API Restrictions
1. Google Cloud Console > APIs & Services > Credentials
2. Click on your service account key
3. Check if there are any API restrictions
4. Make sure Gmail API is allowed

### Verify Project Billing
1. Google Cloud Console > Billing
2. Make sure the project has active billing
3. Some APIs require billing even for free tier

## Test Commands to Run

1. **Check API Status:**
   ```bash
   node check-project-apis.js
   ```

2. **Test Basic Auth:**
   ```bash
   node debug-gmail-api.js
   ```

3. **Test with Different Scopes:**
   ```bash
   node test-all-scopes.js
   ```

4. **Comprehensive Test:**
   ```bash
   node test-comprehensive.js
   ```

## Expected Success Output
When working correctly, you should see:
```
✅ Authentication successful!
📧 Email: user@domain.com
🎉 Gmail API test completed successfully!
```

## Most Likely Solution
Based on the error pattern, the issue is probably:
1. **Gmail API not fully enabled** in Google Cloud Console
2. **Domain-wide delegation not properly configured** in Google Workspace Admin
3. **Service account missing proper permissions**

Check these in order, and the API should start working.