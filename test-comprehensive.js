const { google } = require('googleapis');

const SERVICE_ACCOUNT_FILE = './superheroboardv2-84db896e1c9c.json';

// Test different scope combinations
const SCOPE_TESTS = [
  {
    name: 'Gmail Readonly',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly']
  },
  {
    name: 'Gmail Full',
    scopes: ['https://www.googleapis.com/auth/gmail.modify']
  },
  {
    name: 'Gmail + Directory',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/admin.directory.user.readonly'
    ]
  }
];

const USERS_TO_TEST = [
  'kristen@ecoship.com',
  'customerservice@higleyenterprises.com'
];

async function testUser(user, scopeTest) {
  try {
    console.log(`\n🔍 Testing ${user} with ${scopeTest.name}...`);
    
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: scopeTest.scopes,
      subject: user
    });

    const authClient = await auth.getClient();
    
    // Test 1: Try Directory API first (if included)
    if (scopeTest.scopes.includes('https://www.googleapis.com/auth/admin.directory.user.readonly')) {
      try {
        const admin = google.admin({ version: 'directory_v1', auth: authClient });
        const userInfo = await admin.users.get({ userKey: user });
        console.log(`  ✅ Directory API: User exists - ${userInfo.data.primaryEmail}`);
      } catch (dirError) {
        console.log(`  ❌ Directory API failed: ${dirError.message}`);
      }
    }
    
    // Test 2: Try Gmail API
    try {
      const gmail = google.gmail({ version: 'v1', auth: authClient });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log(`  ✅ Gmail API SUCCESS: ${profile.data.emailAddress}`);
      return true;
    } catch (gmailError) {
      console.log(`  ❌ Gmail API failed: ${gmailError.message}`);
      return false;
    }
    
  } catch (authError) {
    console.log(`  ❌ Auth failed: ${authError.message}`);
    return false;
  }
}

async function runComprehensiveTest() {
  console.log('🚀 Starting comprehensive Gmail API test...\n');
  
  // Check service account details
  const serviceAccount = require('./superheroboardv2-84db896e1c9c.json');
  console.log('📋 Service Account Info:');
  console.log('  Email:', serviceAccount.client_email);
  console.log('  Project:', serviceAccount.project_id);
  console.log('  Client ID:', serviceAccount.client_id);
  
  let anySuccess = false;
  
  for (const scopeTest of SCOPE_TESTS) {
    console.log(`\n🔬 Testing scope combination: ${scopeTest.name}`);
    console.log(`   Scopes: ${scopeTest.scopes.join(', ')}`);
    
    for (const user of USERS_TO_TEST) {
      const success = await testUser(user, scopeTest);
      if (success) anySuccess = true;
    }
  }
  
  console.log('\n📊 Test Summary:');
  if (anySuccess) {
    console.log('✅ At least one configuration worked!');
  } else {
    console.log('❌ No configurations worked. Possible issues:');
    console.log('   1. Domain delegation scopes mismatch in Google Admin Console');
    console.log('   2. Users might not exist or Gmail not enabled');
    console.log('   3. Need different OAuth scopes in delegation');
  }
}

runComprehensiveTest();