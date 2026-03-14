const fs = require('fs');

let pkg = JSON.parse(fs.readFileSync('core/config/package.json', 'utf8'));
pkg.dependencies["@goddard-ai/schema"] = "workspace:*";
fs.writeFileSync('core/config/package.json', JSON.stringify(pkg, null, 2));
