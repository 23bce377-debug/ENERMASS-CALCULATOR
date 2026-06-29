const fs = require('fs');
const dotenv = require('dotenv');

try {
  const content = fs.readFileSync('.env.local', 'utf8');
  const config = dotenv.parse(content);
  console.log('Environment variable keys found in .env.local:');
  console.log(Object.keys(config));
} catch (err) {
  console.error('Error reading .env.local:', err.message);
}
