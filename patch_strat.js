const fs = require('fs');

let content = fs.readFileSync('core/loop/src/strategies.ts', 'utf8');
content = content.replace(/CycleContext/g, 'LoopContext');
content = content.replace(/CycleStrategy/g, 'LoopStrategy');
content = content.replace(/import type \{ LoopContext, LoopStrategy \} from "\.\/types\.ts";/, 'import type { LoopContext, LoopStrategy } from "@goddard-ai/schema/loop";');

fs.writeFileSync('core/loop/src/strategies.ts', content);

let typesContent = fs.readFileSync('core/loop/src/types.ts', 'utf8');
typesContent = typesContent.replace(/CycleContext,\n  CycleStrategy,\n/g, '');
typesContent = typesContent.replace(/CycleContext, CycleStrategy, /g, '');
fs.writeFileSync('core/loop/src/types.ts', typesContent);
