const fs = require('fs');
const file = 'core/backend/src/index.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace('import type { Env } from "./env.ts"\n', '');

fs.writeFileSync(file, code);
