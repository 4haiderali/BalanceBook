import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
fs.mkdirSync('audit/.out',{recursive:true});
for(const f of ['core','edit','parking']){for(const args of [['audit/build.mjs',`audit/${f}.src.mjs`,`audit/.out/${f}.mjs`],[`audit/.out/${f}.mjs`]]){const r=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:2**24});const output=r.stdout+r.stderr;if(r.status||/^\s*FAIL /m.test(output)){console.error(output);process.exit(1)}if(args.length===1)console.log(output.trim().split('\n').slice(-1)[0])}}
