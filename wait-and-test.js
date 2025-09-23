const { google } = require('googleapis');

const SERVICE_ACCOUNT_FILE = './superheroboardv2-84db896e1c9c.json';
const IMPERSONATE_USER = 'kristen@ecoship.com';
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

async function testGmailOnce() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: SCOPES,
      subject: IMPERSONATE_USER
    });

    const authClient = await auth.getClient();
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    const profile = await gmail.users.getProfile({ userId: 'me' });
    return { success: true, email: profile.data.emailAddress };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function waitAndTest() {
  console.log('⏰ Waiting for Google domain delegation to propagate...');
  console.log('   This can take 5-15 minutes after authorization\n');
  
  let attempt = 1;
  const maxAttempts = 10; // Try for ~20 minutes
  
  while (attempt <= maxAttempts) {
    console.log(`🔍 Attempt ${attempt}/${maxAttempts} - ${new Date().toLocaleTimeString()}`);
    
    const result = await testGmailOnce();
    
    if (result.success) {
      console.log(`\n🎉 SUCCESS! Gmail API is working!`);
      console.log(`📧 Connected to: ${result.email}`);
      console.log(`\n✅ Your domain delegation is now active!`);
      return;
    } else {
      console.log(`   ❌ Still failing: ${result.error}`);
      
      if (attempt < maxAttempts) {
        console.log(`   ⏳ Waiting 2 minutes before next attempt...\n`);
        await new Promise(resolve => setTimeout(resolve, 120000)); // Wait 2 minutes
      }
    }
    
    attempt++;
  }
  
  console.log('\n⚠️  Still not working after 20 minutes.');
  console.log('   Double-check the authorization in Google Admin Console');
}

console.log('🚀 Starting wait-and-test cycle...\n');
waitAndTest();