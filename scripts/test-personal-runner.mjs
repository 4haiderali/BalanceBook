import {spawnSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'haider-personal-'));
try{const out=join(dir,'test.mjs');const result=spawnSync(process.execPath,['audit/build.mjs','scripts/test-personal.mjs',out],{encoding:'utf8'});if(result.status)throw Error(result.stderr);await import(pathToFileURL(out).href)}finally{await rm(dir,{recursive:true,force:true})}
