/**
 * Utility script to generate password hash
 * Run with: node scripts/generate-password-hash.js YOUR_PASSWORD
 */

const bcrypt = require('bcryptjs');

async function generateHash() {
  const password = process.argv[2];
  
  if (!password) {
    console.log('Usage: node generate-password-hash.js YOUR_PASSWORD');
    console.log('');
    console.log('This will generate a bcrypt hash for your admin password.');
    console.log('Add the hash to your .env file as ADMIN_PASSWORD_HASH');
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  
  console.log('');
  console.log('Password Hash Generated!');
  console.log('========================');
  console.log('');
  console.log('Add this to your .env file:');
  console.log('');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('');
  console.log('⚠️  Keep this hash secure and never share the original password!');
}

generateHash().catch(console.error);
