const { google } = require('googleapis');
const path = require('path');

// Configuration
const SERVICE_ACCOUNT_FILE = './superheroboardv2-2fb1a9326876.json'; // back to gmail-api-access
const IMPERSONATE_USER = 'kristen@ecoship.com'; // testing with different user
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

async function testGmailAPI() {
  try {
    console.log('🔐 Setting up Gmail API authentication...');
    
    // Create JWT client with service account
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: SCOPES,
      subject: IMPERSONATE_USER // This does the impersonation
    });

    // Get authenticated client
    const authClient = await auth.getClient();
    
    // Create Gmail service
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    console.log('✅ Authentication successful!');

    // Get the user's Gmail profile to test
    console.log('\n📧 Getting Gmail profile...');
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('Email:', profile.data.emailAddress);

    // List the 5 most recent messages
    console.log('\n📥 Getting recent messages...');
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 5
    });

    const messages = listResponse.data.messages || [];
    console.log(`Found ${messages.length} messages:\n`);

    // Get details for each message
    for (const msg of messages) {
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id
      });

      // Find the Subject header
      const headers = message.data.payload.headers || [];
      const subjectHeader = headers.find(h => h.name === 'Subject');
      const subject = subjectHeader ? subjectHeader.value : 'N/A';

      console.log(`Subject: ${subject}`);
    }

    console.log('\n🎉 Gmail API test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing Gmail API:', error.message);
    
    // More specific error handling
    if (error.message.includes('403')) {
      console.error('💡 Make sure domain-wide delegation is set up for your service account');
    } else if (error.message.includes('ENOENT')) {
      console.error('💡 Make sure the JSON key file exists in the right location');
    }
  }
}

// Run the test
if (require.main === module) {
  console.log('🚀 Starting Gmail API test...\n');
  testGmailAPI();
}

module.exports = { testGmailAPI };