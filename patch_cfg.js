const fs = require('fs');

let content = fs.readFileSync('core/config/src/index.ts', 'utf8');
content = content.replace(/import \{ z \} from "zod"/, 'import { z } from "zod"\nimport type { LoopStrategy, LoopContext } from "@goddard-ai/schema/loop";\nexport type { LoopStrategy, LoopContext };\n');
fs.writeFileSync('core/config/src/index.ts', content);
