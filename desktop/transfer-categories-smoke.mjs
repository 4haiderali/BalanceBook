import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {emptyLedger} from '../lib/empty-ledger.ts';
import {makeEntry,totals,report} from '../lib/ledger.ts';
import {createBackup} from '../lib/backup.ts';
const dir=await mkdtemp(join(tmpdir(),'balancebook-transfer-repair-'));
let server;
try{
 const base={...emptyLedger('2026-01-01'),openings:{Cash:100000,Alfalah:0}};
 const raw={id:'transfer',date:'2026-11-01',month:'2026-11',kind:'transfer',amount:10000,account:'Cash',to:'Alfalah',description:'Synthetic transfer',category:'Food',person:'',notes:''};
 const old={...base,entries:[{...makeEntry(raw,base),category:'Food'}]};
 const backup=join(dir,'fixture.json');await writeFile(backup,JSON.stringify(await createBackup(old,7)));
 const env={...process.env,HAIDER_DATA:dir,HAIDER_READY:join(dir,'ready'),HAIDER_TOKEN:'synthetic-repair-check'};delete env.HAIDER_REPORT_CONFIG;
 const restored=spawnSync(process.execPath,['desktop-dist/server.mjs','--restore-backup',backup],{env,encoding:'utf8'});
 assert.equal(restored.status,0,restored.stderr);
 server=spawn(process.execPath,['desktop-dist/server.mjs'],{env,stdio:'ignore'});
 let port;for(let i=0;i<100;i++){port=await readFile(env.HAIDER_READY,'utf8').catch(()=>null);if(port)break;await delay(50)}
 assert.ok(port,'Server ready');const origin='http://127.0.0.1:'+port;
 const headers={'X-Haider-Session':env.HAIDER_TOKEN,Origin:origin,'Content-Type':'application/json'};
 const get=async(path='')=>{const r=await fetch(origin+'/api/ledger'+path,{headers});assert.equal(r.status,200);return r.json()};
 const before=await get();assert.equal(before.data.entries[0].category,'Food');
 const response=await fetch(origin+'/api/ledger',{method:'POST',headers,body:JSON.stringify({revision:before.revision,operation:'repair-transfer-categories'})});
 const after=await response.json();assert.equal(response.status,200,JSON.stringify(after));
 assert.equal(after.revision,before.revision+1);assert.equal(after.data.entries[0].category,'');
 assert.deepEqual(totals(after.data),totals(before.data));assert.deepEqual(report(after.data,'2026-11'),report(before.data,'2026-11'));
 assert.deepEqual((await get('?revision='+before.revision)).data,before.data);
 assert.equal(after.data.audit.at(-1).before.category,'Food');assert.equal(after.data.audit.at(-1).after.category,'');
 const again=await fetch(origin+'/api/ledger',{method:'POST',headers,body:JSON.stringify({revision:after.revision,operation:'repair-transfer-categories'})});
 assert.equal((await again.json()).revision,after.revision);
 const stale=await fetch(origin+'/api/ledger',{method:'POST',headers,body:JSON.stringify({revision:before.revision,operation:'repair-transfer-categories'})});assert.equal(stale.status,409);
 console.log('PASS transfer repair API: restored old-category backup, audited revision, exact prior snapshot, unchanged balances/spending, idempotent retry and stale-revision rejection.');
}finally{
 if(server?.exitCode===null){const exit=once(server,'exit');server.kill();await exit;}
 await rm(dir,{recursive:true,force:true});
}
