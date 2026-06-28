const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\hrush\\.gemini\\antigravity-ide\\brain\\dc269aef-9cf5-49bd-b3d2-4356e826c2e4\\.system_generated\\logs\\transcript_full.jsonl';
const outputPath = path.join(__dirname, '..', 'enermass-quote-template.html');

try {
  const fileContent = fs.readFileSync(logPath, 'utf8');
  const lines = fileContent.split('\n');
  if (lines.length > 0 && lines[0].trim() !== '') {
    const data = JSON.parse(lines[0]);
    const content = data.content;
    
    // The content starts with the user guide, and then has the HTML. Let's find where the HTML starts.
    const htmlStartIndex = content.indexOf('<!DOCTYPE html>');
    if (htmlStartIndex !== -1) {
      const htmlContent = content.substring(htmlStartIndex);
      fs.writeFileSync(outputPath, htmlContent, 'utf8');
      console.log(`Successfully extracted HTML template to ${outputPath}`);
    } else {
      console.error('Could not find <!DOCTYPE html> in the first prompt content');
    }
  } else {
    console.error('Empty log file or no lines');
  }
} catch (err) {
  console.error('Error processing file:', err);
}
