const fs = require('fs');

let content = fs.readFileSync('core/sdk/src/node/loop.ts', 'utf8');

content = content.replace(
    /strategy: config.strategy\n  \}\)/,
    `strategy: config.strategy,\n    rateLimits: {\n      cycleDelay: config.rateLimits?.cycleDelay,\n      maxTokensPerCycle: config.rateLimits?.maxTokensPerCycle,\n      maxOpsPerMinute: config.rateLimits?.maxOpsPerMinute,\n      maxCyclesBeforePause: config.rateLimits?.maxCyclesBeforePause\n    }\n  })`
);

fs.writeFileSync('core/sdk/src/node/loop.ts', content);
