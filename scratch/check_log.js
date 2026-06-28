const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\hrush\\.gemini\\antigravity-ide\\brain\\dc269aef-9cf5-49bd-b3d2-4356e826c2e4\\.system_generated\\logs\\transcript_full.jsonl';
const fileContent = fs.readFileSync(logPath, 'utf8');
const lines = fileContent.split('\n');
console.log('Total lines in log:', lines.length);
if (lines.length > 0) {
  const data = JSON.parse(lines[0]);
  const content = data.content;
  console.log('Content length (chars):', content.length);
  console.log('Ends with:', content.substring(content.length - 200));
}
