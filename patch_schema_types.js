const fs = require('fs');
const file1 = 'core/backend/src/api/in-memory-control-plane.ts';
const file2 = 'core/backend/src/utils.ts';
let code1 = fs.readFileSync(file1, 'utf8');
let code2 = fs.readFileSync(file2, 'utf8');

code1 = code1.replace('} from "../../schema/src/index.ts"', '} from "@goddard-ai/schema"');
code2 = code2.replace('} from "../../schema/src/index.ts"', '} from "@goddard-ai/schema"');

fs.writeFileSync(file1, code1);
fs.writeFileSync(file2, code2);
