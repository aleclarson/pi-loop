const fs = require('fs');
let index = fs.readFileSync('core/schema/src/index.ts', 'utf8');
if (!index.includes('export * from "./loop.js"')) {
    fs.writeFileSync('core/schema/src/index.ts', index + '\nexport * from "./loop.js"\n');
}
