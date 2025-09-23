const fs = require('fs');

// Read your service account key file
const serviceAccount = JSON.parse(fs.readFileSync('./superheroboardv2-84db896e1c9c.json', 'utf8'));

console.log('🔑 Service Account Info:');
console.log('Email:', serviceAccount.client_email);
console.log('Client ID:', serviceAccount.client_id);
console.log('Project ID:', serviceAccount.project_id);

console.log('\n📋 Copy this Client ID for Google Admin Console:');
console.log('👉', serviceAccount.client_id);