const fs = require('fs');
const path = require('path');

const schemaPath = path.resolve(process.cwd(), 'schema.sql');
const content = fs.readFileSync(schemaPath, 'utf8');
const lines = content.split('\n');

console.log('Searching for systems in schema.sql:');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('create table systems') || line.toLowerCase().includes('create table system_items')) {
    console.log(`Line ${idx + 1}: ${line}`);
    // Print the next 25 lines
    for (let i = 0; i < 25; i++) {
      console.log(`  +${i}: ${lines[idx + i]}`);
    }
  }
});
