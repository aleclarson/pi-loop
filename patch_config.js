const fs = require('fs');

let content = fs.readFileSync('core/config/src/index.ts', 'utf8');

// remove CycleContext definition
content = content.replace(
    /\/\*\*\n \* Snapshot of loop state passed to \{@link CycleStrategy\.nextPrompt\} at the\n \* start of each cycle\.\n \*\/\nexport interface CycleContext \{\n  cycleNumber: number;\n  lastSummary\?: string;\n\}\n\n/,
    ""
);

// remove CycleStrategy definition
content = content.replace(
    /\/\/\ \-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\n\/\/ CycleStrategy\n\/\/ \-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\n\n\/\*\*[\s\S]*?export type CycleStrategy = \{\n  nextPrompt\(ctx: CycleContext\): string\n\}\n/,
    ""
);

// replace CycleStrategy uses with LoopStrategy
content = content.replace(/CycleStrategy/g, 'LoopStrategy');
content = content.replace(/CycleContext/g, 'LoopContext');
content = content.replace(/cycleStrategySchema/g, 'loopStrategySchema');

const importStatement = `import type { LoopStrategy, LoopContext } from "@goddard-ai/schema/loop";\nexport type { LoopStrategy, LoopContext };\n\n`;

content = content.replace(/import \* as z from "zod"/, 'import * as z from "zod"\n' + importStatement);

fs.writeFileSync('core/config/src/index.ts', content);
