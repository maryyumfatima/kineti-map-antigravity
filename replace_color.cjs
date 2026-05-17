const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./src');
let count = 0;
files.forEach(file => {
    if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css') || file.endsWith('.json')) {
        let content = fs.readFileSync(file, 'utf8');
        if (content.match(/#2c1a12/i)) {
            content = content.replace(/#2c1a12/gi, '#32323f');
            fs.writeFileSync(file, content, 'utf8');
            console.log('Updated ' + file);
            count++;
        }
    }
});
console.log('Total files updated: ' + count);
