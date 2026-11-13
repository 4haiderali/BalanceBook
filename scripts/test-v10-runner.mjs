import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'haider-money-v10-'));
try{const out=join(dir,'test.mjs');await build({entryPoints:['scripts/test-v10.mjs'],banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},bundle:true,platform:'node',format:'esm',outfile:out});await import(pathToFileURL(out).href)}finally{await rm(dir,{recursive:true,force:true})}
