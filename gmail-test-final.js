const { google } = require('googleapis');

const SERVICE_ACCOUNT_FILE = './superheroboardv2-22da6951042a.json';
const TEST_USERS = [
  'kristen@ecoship.com',
  'customerservice@higleyenterprises.com', 
  'it@ecoship.com'
];

async function testServiceAccountPermissions() {
  console.log('🔍 Testing service account permissions...\n');
  
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: [
        'https://www.googleapis.com/auth/service.management.readonly',
        'https://www.googleapis.com/auth/serviceusage'
      ]
    });

    const authClient = await auth.getClient();
    
    // Test Service Usage API access
    const serviceUsage = google.serviceusage({ version: 'v1', auth: authClient });
    const credentials = require(SERVICE_ACCOUNT_FILE);
    
    const result = await serviceUsage.services.list({
      parent: `projects/${credentials.project_id}`,
      filter: 'state:ENABLED'
    });
    
    const enabledServices = result.data.services || [];
    console.log('✅ Service account auth works!');
    console.log(`📋 Found ${enabledServices.length} enabled APIs`);
    
    // Check specifically for Gmail API
    const gmailAPI = enabledServices.find(service => 
      service.name.includes('gmail.googleapis.com')
    );
    
    if (gmailAPI) {
      console.log('📧 Gmail API is enabled ✅');
    } else {
      console.log('❌ Gmail API not found in enabled services');
      console.log('💡 Go to Google Cloud Console > APIs & Services > Library');
      console.log('💡 Search "Gmail API" and click ENABLE');
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ Service account permissions issue:', error.message);
    console.log('💡 Go to Google Cloud Console > IAM & Admin > IAM');
    console.log('💡 Add "Service Usage Consumer" role to your service account');
    return false;
  }
}

async function testGmailAPIAccess(user) {
  console.log(`\n📧 Testing Gmail API access for: ${user}`);
  
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
      ],
      subject: user
    });

    const authClient = await auth.getClient();
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    // Test 1: Get profile
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log(`   ✅ Profile access: ${profile.data.emailAddress}`);

    // Test 2: List recent messages
    const messages = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 3
    });
    
    const messageCount = messages.data.messages?.length || 0;
    console.log(`   ✅ Message access: Found ${messageCount} recent messages`);

    // Test 3: Get labels
    const labels = await gmail.users.labels.list({ userId: 'me' });
    const labelCount = labels.data.labels?.length || 0;
    console.log(`   ✅ Label access: Found ${labelCount} labels`);

    return true;

  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    
    if (error.message.includes('Precondition check failed')) {
      console.log('   💡 Still getting precondition error - check billing and API restrictions');
    } else if (error.message.includes('domain-wide delegation')) {
      console.log('   💡 Domain-wide delegation not configured');
      console.log('   💡 Go to Google Workspace Admin Console > Security > API Controls');
    } else if (error.message.includes('insufficient authentication')) {
      console.log('   💡 Service account needs more permissions in Google Cloud Console');
    }
    
    return false;
  }
}

async function runComprehensiveTest() {
  console.log('🚀 Gmail API Comprehensive Test\n');
  console.log('=' .repeat(50));
  
  // Step 1: Test basic service account permissions
  const basicAuthWorks = await testServiceAccountPermissions();
  
  if (!basicAuthWorks) {
    console.log('\n❌ FAILED: Fix service account permissions first');
    return;
  }

  // Step 2: Test Gmail API access for each user
  console.log('\n' + '='.repeat(50));
  console.log('Testing Gmail API access...');
  
  let successCount = 0;
  
  for (const user of TEST_USERS) {
    const success = await testGmailAPIAccess(user);
    if (success) successCount++;
  }
  
  // Final summary
  console.log('\n' + '='.repeat(50));
  console.log('🎯 FINAL RESULTS:');
  console.log(`✅ Successful Gmail API access: ${successCount}/${TEST_USERS.length} users`);
  
  if (successCount === TEST_USERS.length) {
    console.log('🎉 Gmail API is working perfectly!');
    console.log('💡 You can now integrate Gmail functionality into your app');
  } else if (successCount === 0) {
    console.log('❌ Gmail API not working for any users');
    console.log('💡 Follow the steps in gmail-solution-steps.md');
  } else {
    console.log('⚠️  Gmail API working for some users only');
    console.log('💡 Check user-specific Gmail settings in Google Workspace Admin');
  }
}

// Export for use in other scripts
module.exports = { testServiceAccountPermissions, testGmailAPIAccess };

// Run if called directly
if (require.main === module) {
  runComprehensiveTest();
}