const fs = require('fs');
const path = require('path');

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

      // Remove destructuring of country from useParams
      content = content.replace(/const\s+\{\s*country\s*\}\s*=\s*useParams\(\{ strict: false \}\)\s*as\s*\{\s*\}[\r\n]*/g, '');
      content = content.replace(/const\s+\{\s*country\s*\}\s*=\s*useParams\(\{ strict: false \}\)[\r\n]*/g, '');
      content = content.replace(/const\s+\{\s*country\s*\}\s*=\s*Route\.useParams\(\)[\r\n]*/g, '');
      
      // If it also had other params: const { country, patientId } = useParams({ strict: false }) as { patientId: string }
      content = content.replace(/const\s+\{\s*country,\s*([a-zA-Z0-9_]+)\s*\}\s*=\s*useParams\(\{ strict: false \}\)\s*as\s*\{\s*[a-zA-Z0-9_]+\s*:\s*string\s*\}[\r\n]*/g, 'const { $1 } = useParams({ strict: false }) as { $1: string }\n');

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

processDir(path.join(__dirname, 'src'));
console.log("Removed useParams usages for country.");
