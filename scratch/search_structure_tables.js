const fs = require('fs');
const path = require('path');

const tables = [
  'structure_accessory_rates',
  'structure_material_rates',
  'structure_weight_lookup',
  'eq_structure_components',
  'eq_structure_bom',
  'eq_structure_addons'
];

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
          if (file.includes('node_modules') || file.includes('.next') || file.includes('.git') || file.includes('scratch')) {
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
  
  const results = {};
  tables.forEach(t => {
    results[t] = [];
  });

  files.forEach(file => {
    if (file.endsWith('.xlsx') || file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.tsbuildinfo')) return;
    try {
      const content = fs.readFileSync(file, 'utf8');
      tables.forEach(t => {
        if (content.includes(t)) {
          results[t].push(path.relative(process.cwd(), file));
        }
      });
    } catch (e) {
      // ignore
    }
  });

  console.log(JSON.stringify(results, null, 2));
});
