const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'src', 'routes');

// 1. Rename files
const files = fs.readdirSync(routesDir);
for (const file of files) {
  if (file.startsWith('$country.') && file !== '$country.tsx') {
    const newName = file.replace('$country.', '');
    fs.renameSync(path.join(routesDir, file), path.join(routesDir, newName));
  }
}

if (fs.existsSync(path.join(routesDir, '$country.tsx'))) {
  fs.unlinkSync(path.join(routesDir, '$country.tsx'));
}

// 2. Refactor content in all files
function processDir(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;

      // Replace route definitions
      content = content.replace(/createFileRoute\('\/\$country\//g, "createFileRoute('/");
      content = content.replace(/createFileRoute\('\/\$country'\)/g, "createFileRoute('/')");

      // Replace Link and navigate params
      content = content.replace(/to: '\/\$country\//g, "to: '/");
      content = content.replace(/to="\/\$country\//g, 'to="/');
      content = content.replace(/,\s*params:\s*\{\s*country\s*\}\s*as\s*any/g, '');
      content = content.replace(/params=\{\{\s*country\s*\}\s*as\s*any\}/g, '');
      content = content.replace(/params: \{ country \}/g, '');

      // Sometimes country is passed as `params={{ country: params.country, id: x }}` or similar.
      content = content.replace(/country: [a-zA-Z0-9_.]+,?\s*/g, '');

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

processDir(path.join(__dirname, 'src'));

console.log("Renamed and basic string replacements done.");
