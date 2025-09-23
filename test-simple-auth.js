const { google } = require('googleapis');

const SERVICE_ACCOUNT_FILE = './superheroboardv2-2fb1a9326876.json';

async function testSimpleAuth() {
  console.log('🔍 Testing basic service account functionality...\n');
  
  try {
    // Test 1: Basic auth without any impersonation
    console.log('📝 Test 1: Basic service account auth (no impersonation)...');
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: ['https://www.googleapis.com/auth/cloud-platform.read-only']
    });

    const authClient = await auth.getClient();
    console.log('✅ Basic auth works!');
    
    // Test 2: Try to access project info
    console.log('\n📝 Test 2: Accessing project information...');
    const credentials = require(SERVICE_ACCOUNT_FILE);
    console.log('📋 Project ID:', credentials.project_id);
    console.log('📋 Service Account Email:', credentials.client_email);
    
    // Test 3: Try a simple API call
    console.log('\n📝 Test 3: Testing simple API access...');
    const serviceUsage = google.serviceusage({ version: 'v1', auth: authClient });
    
    try {
      const result = await serviceUsage.services.list({
        parent: `projects/${credentials.project_id}`,
        filter: 'state:ENABLED',
        pageSize: 5
      });
      
      console.log('✅ Service Usage API works!');
      console.log(`📋 Found ${result.data.services?.length || 0} enabled APIs`);
      
      // Check if Gmail API is in the list
      const gmailAPI = result.data.services?.find(service => 
        service.name.includes('gmail.googleapis.com')
      );
      
      if (gmailAPI) {
        console.log('📧 Gmail API is enabled ✅');
      } else {
        console.log('❌ Gmail API not found in enabled services');
      }
      
    } catch (apiError) {
      console.log('❌ Service Usage API failed:', apiError.message);
    }
    
    // Test 4: Try Gmail API directly (should fail but with different error)
    console.log('\n📝 Test 4: Testing Gmail API directly (should fail)...');
    const gmail = google.gmail({ version: 'v1', auth: authClient });
    
    try {
      await gmail.users.getProfile({ userId: 'me' });
      console.log('🤔 Unexpected success - service account shouldn\'t have direct Gmail access');
    } catch (gmailError) {
      console.log('📋 Expected Gmail error:', gmailError.message);
      
      if (gmailError.message.includes('Precondition check failed')) {
        console.log('💡 This confirms the issue is with domain-wide delegation, not the service account');
      } else if (gmailError.message.includes('Request had invalid authentication')) {
        console.log('✅ This is the expected error for service accounts without impersonation');
      }
    }
    
  } catch (error) {
    console.error('❌ Basic auth failed:', error.message);
    console.log('💡 This suggests a fundamental service account or project issue');
  }
}

testSimpleAuth(); 