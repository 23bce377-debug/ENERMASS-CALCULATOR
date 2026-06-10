const fs = require('fs');

const lines = fs.readFileSync('schema.sql', 'utf8').split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('insert into rate_master') || line.toLowerCase().includes('rate_master')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
