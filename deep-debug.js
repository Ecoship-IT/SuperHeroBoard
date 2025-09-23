const { google } = require('googleapis');
const fs = require('fs');

const SERVICE_ACCOUNT_FILE = './superheroboardv2-84db896e1c9c.json';

async function deepDebug() {
  console.log('🕵️‍♂️ Deep debugging Gmail API issue...\n');
  
  // 1. Verify service account file
  console.log('1️⃣ Checking service account file...');
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf8'));
    console.log('   ✅ File exists and is valid JSON');
    console.log('   📧 Service Account:', serviceAccount.client_email);
    console.log('   🆔 Client ID:', serviceAccount.client_id);
    console.log('   🏢 Project ID:', serviceAccount.project_id);
    console.log('   🔑 Has private key:', serviceAccount.private_key ? 'YES' : 'NO');
  } catch (error) {
    console.log('   ❌ Service account file error:', error.message);
    return;
  }
  
  console.log('\n2️⃣ Testing WITHOUT impersonation (service account direct)...');
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    
    const authClient = await auth.getClient();
    console.log('   ✅ Service account auth works');
    
    // Try to list enabled APIs
    const serviceUsage = google.serviceusage({ version: 'v1', auth: authClient });
    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf8'));
    
    try {
      const response = await serviceUsage.services.list({
        parent: `projects/${serviceAccount.project_id}`,
        filter: 'state:ENABLED'
      });
      
      const enabledAPIs = response.data.services || [];
      const gmailAPI = enabledAPIs.find(api => api.name.includes('gmail'));
      
      console.log('   📋 Gmail API Status:', gmailAPI ? 'ENABLED ✅' : 'NOT FOUND ❌');
      
    } catch (apiError) {
      console.log('   ⚠️  Could not check API status:', apiError.message);
    }
    
  } catch (error) {
    console.log('   ❌ Service account auth failed:', error.message);
  }
  
  console.log('\n3️⃣ Testing WITH impersonation (the failing part)...');
  const usersToTest = [
    'kristen@ecoship.com',
    'customerservice@higleyenterprises.com'
  ];
  
  for (const user of usersToTest) {
    console.log(`\n   🧪 Testing user: ${user}`);
    
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        subject: user
      });
      
      console.log('      ✅ Auth object created');
      
      const authClient = await auth.getClient();
      console.log('      ✅ Auth client obtained');
      
      // Try to get an access token
      const accessToken = await authClient.getAccessToken();
      console.log('      ✅ Access token obtained');
      
      // Try Gmail API
      const gmail = google.gmail({ version: 'v1', auth: authClient });
      
      // Instead of getProfile, try a simpler call
      try {
        const labels = await gmail.users.labels.list({ userId: 'me' });
        console.log('      ✅ SUCCESS! Gmail labels retrieved:', labels.data.labels?.length || 0, 'labels');
        
        // Now try profile
        const profile = await gmail.users.getProfile({ userId: 'me' });
        console.log('      ✅ SUCCESS! Profile:', profile.data.emailAddress);
        
      } catch (gmailError) {
        console.log('      ❌ Gmail API Error:');
        console.log('         Status:', gmailError.status);
        console.log('         Code:', gmailError.code);  
        console.log('         Message:', gmailError.message);
        
        // Check if it's specifically about the user
        if (gmailError.message.includes('does not exist') || gmailError.message.includes('not found')) {
          console.log('      💡 This user might not exist or Gmail not enabled for them');
        }
      }
      
    } catch (authError) {
      console.log('      ❌ Auth Error:', authError.message);
      
      if (authError.message.includes('delegation')) {
        console.log('      💡 Domain delegation is definitely the issue');
      }
    }
  }
  
  console.log('\n4️⃣ Checking common domain delegation issues...');
  console.log('   ❓ Questions to verify:');
  console.log('   1. Are you a Super Admin in Google Workspace admin console?');
  console.log('   2. Is the Client ID EXACTLY: 117706433447438028506');
  console.log('   3. Is the scope EXACTLY: https://www.googleapis.com/auth/gmail.readonly');
  console.log('   4. Did you click "Authorize" after adding?');
  console.log('   5. Are both users valid Google Workspace users?');
  console.log('   6. Do both users have Gmail enabled in their accounts?');
}

deepDebug();