const fs = require('fs');
const path = require('path');

function walk(dir, done) {
  let results = [];
  fs.readdir(dir, (err, list) => {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(file => {
      file = path.resolve(dir, file);
      fs.stat(file, (err, stat) => {
        if (stat && stat.isDirectory()) {
          // Skip node_modules, .next, .git
          if (file.includes('node_modules') || file.includes('.next') || file.includes('.git') || file.includes('.gemini') || file.includes('scratch')) {
            if (!--pending) done(null, results);
          } else {
            walk(file, (err, res) => {
              results = results.concat(res);
              if (!--pending) done(null, results);
            });
          }
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
}

walk('.', (err, files) => {
  if (err) throw err;
  const matches = [];
  files.forEach(file => {
    // Skip binary files and some build outputs
    if (file.endsWith('.xlsx') || file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.tsbuildinfo')) return;
    try {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('eq_bom_items')) {
        matches.push(file);
      }
    } catch (e) {
      // ignore read errors
    }
  });
  console.log('Matches for eq_bom_items:', matches.map(m => path.relative(process.cwd(), m)));
});
