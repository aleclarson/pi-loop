const fs = require('fs');
let content = fs.readFileSync('core/config/src/index.ts', 'utf8');

content = content.replace(/export type LoopStrategy = \{\n  nextPrompt\(ctx: LoopContext\): string\n\}\n/, '');

fs.writeFileSync('core/config/src/index.ts', content);
