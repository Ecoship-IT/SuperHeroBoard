const { google } = require('googleapis');

const SERVICE_ACCOUNT_FILE = './superheroboardv2-84db896e1c9c.json';

async function diagnosePreconditionError() {
  console.log('🔍 Diagnosing Gmail API "Precondition check failed" error...\n');

  try {
    // Step 1: Test without any domain impersonation first
    console.log('📝 Step 1: Testing service account without impersonation...');
    
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly']
    });

    const authClient = await auth.getClient();
    
    // Get project info
    const credentials = require(SERVICE_ACCOUNT_FILE);
    console.log('   📋 Project ID:', credentials.project_id);
    console.log('   📋 Service Account Email:', credentials.client_email);
    
    // Try a simple non-Gmail API call first to test basic auth
    console.log('\n📝 Step 2: Testing basic service account auth with Service Usage API...');
    try {
      const serviceUsage = google.serviceusage({ version: 'v1', auth: authClient });
      const result = await serviceUsage.services.list({
        parent: `projects/${credentials.project_id}`,
        filter: 'state:ENABLED'
      });
      console.log('   ✅ Service account auth works! Found', result.data.services?.length || 0, 'enabled APIs');
    } catch (serviceError) {
      console.log('   ❌ Basic service account auth failed:', serviceError.message);
      console.log('   💡 This indicates a fundamental service account issue');
      return;
    }

    // Step 3: Check if Gmail API is specifically enabled
    console.log('\n📝 Step 3: Checking if Gmail API is enabled...');
    try {
      const serviceUsage = google.serviceusage({ version: 'v1', auth: authClient });
      const gmailService = await serviceUsage.services.get({
        name: `projects/${credentials.project_id}/services/gmail.googleapis.com`
      });
      console.log('   📧 Gmail API State:', gmailService.data.state);
      
      if (gmailService.data.state !== 'ENABLED') {
        console.log('   ❌ Gmail API is NOT enabled!');
        console.log('   💡 Solution: Go to Google Cloud Console > APIs & Services > Library');
        console.log('   💡 Search for "Gmail API" and click ENABLE');
        return;
      } else {
        console.log('   ✅ Gmail API is properly enabled');
      }
    } catch (gmailCheckError) {
      console.log('   ❌ Could not check Gmail API status:', gmailCheckError.message);
    }

    // Step 4: Try Gmail API without impersonation
    console.log('\n📝 Step 4: Testing Gmail API with service account directly...');
    try {
      const gmail = google.gmail({ version: 'v1', auth: authClient });
      
      // This should fail for service accounts, but the error message will be different
      await gmail.users.getProfile({ userId: 'me' });
      console.log('   🤔 Unexpected success - service account should not have direct Gmail access');
      
    } catch (directGmailError) {
      console.log('   📋 Direct Gmail error (expected):', directGmailError.message);
      
      if (directGmailError.message.includes('Precondition check failed')) {
        console.log('   ❌ FOUND THE ISSUE: "Precondition check failed" error');
        console.log('   💡 This specific error usually means:');
        console.log('      1. Gmail API is enabled but not properly configured');
        console.log('      2. Service account lacks necessary permissions');
        console.log('      3. Project billing is not set up (required for Gmail API)');
        console.log('      4. API usage restrictions are blocking access');
        
        console.log('\n🔧 IMMEDIATE FIXES TO TRY:');
        console.log('   1. Check Google Cloud Console > Billing - ensure active billing');
        console.log('   2. Check APIs & Services > Credentials - remove any API restrictions');
        console.log('   3. Go to IAM & Admin - give service account "Gmail API User" role');
        console.log('   4. Wait 10-15 minutes for changes to propagate');
        
      } else if (directGmailError.message.includes('Request had invalid authentication')) {
        console.log('   ✅ Good! This is the expected error for service accounts');
        console.log('   💡 Now we need to test domain impersonation...');
        return 'ready_for_impersonation';
      }
    }

    return 'precondition_error';

  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
    return 'diagnosis_failed';
  }
}

async function testDomainImpersonation() {
  console.log('\n🔍 Testing domain impersonation after basic fixes...\n');

  const users = ['kristen@ecoship.com', 'customerservice@higleyenterprises.com'];
  
  for (const user of users) {
    console.log(`📧 Testing impersonation for: ${user}`);
    
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        subject: user
      });

      const authClient = await auth.getClient();
      const gmail = google.gmail({ version: 'v1', auth: authClient });
      
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log(`   ✅ SUCCESS! Email: ${profile.data.emailAddress}`);
      return true;
      
    } catch (impersonationError) {
      console.log(`   ❌ Failed: ${impersonationError.message}`);
      
      if (impersonationError.message.includes('domain-wide delegation')) {
        console.log('   💡 Domain-wide delegation not configured properly');
        console.log('   💡 Go to Google Workspace Admin Console > Security > API Controls');
      }
    }
  }
  
  return false;
}

async function runFullDiagnosis() {
  const result = await diagnosePreconditionError();
  
  if (result === 'ready_for_impersonation') {
    await testDomainImpersonation();
  }
  
  console.log('\n🎯 SUMMARY:');
  console.log('   The "Precondition check failed" error is most commonly caused by:');
  console.log('   1. 💳 Missing or inactive billing on the Google Cloud project');
  console.log('   2. 🔒 API restrictions blocking Gmail API access');
  console.log('   3. 👤 Service account missing Gmail-specific permissions');
  console.log('\n   Start with checking billing, then API restrictions, then permissions.');
}

runFullDiagnosis();