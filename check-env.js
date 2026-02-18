// Check environment variables
// Run this with: node check-env.js

require('dotenv').config();

console.log('🔍 Checking environment variables...\n');

const requiredVars = [
  'VITE_SHIPHERO_API_TOKEN',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_ADMIN_PASSWORD'
];

let allPresent = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value && value !== 'your_token_here' && value !== 'your_project_id') {
    console.log(`✅ ${varName}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`❌ ${varName}: Not set or using default value`);
    allPresent = false;
  }
});

console.log('\n' + (allPresent ? '✅ All required environment variables are set!' : '❌ Some environment variables are missing or using default values.'));

// Check if .env file exists
const fs = require('fs');
if (fs.existsSync('.env')) {
  console.log('✅ .env file found');
} else {
  console.log('❌ .env file not found - create one from env.example');
}




