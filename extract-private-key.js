const fs = require('fs');

// Read the JSON file
const keyFile = JSON.parse(fs.readFileSync('./superheroboardv2-22da6951042a.json', 'utf8'));

console.log('🔑 Service Account Email:');
console.log(keyFile.client_email);

console.log('\n🔑 Private Key (Properly Formatted):');
// Format the private key with proper line breaks for OpenSSL
const privateKey = keyFile.private_key;
const formattedKey = privateKey
  .replace(/-----BEGIN PRIVATE KEY-----/, '-----BEGIN PRIVATE KEY-----\n')
  .replace(/-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----')
  .replace(/\\n/g, '\n');

console.log(formattedKey);

console.log('\n📋 Firebase Config Commands:');
console.log(`firebase functions:config:set gmail.service_account_email="${keyFile.client_email}"`);

// For Firebase config, we need to escape the newlines properly
const escapedKey = formattedKey.replace(/\n/g, '\\n');
console.log(`firebase functions:config:set gmail.private_key="${escapedKey}"`);

console.log('\n💡 Note: The private key needs proper line breaks for OpenSSL to decode it.');
console.log('💡 Use the escaped version above for Firebase config.'); 