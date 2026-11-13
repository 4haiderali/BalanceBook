import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {emptyLedger} from '../lib/empty-ledger.ts';
import {activeItems, itemName, itemStatus, manageLedgerItem} from '../lib/ledger-items.ts';
import {emptyEffects} from '../lib/ledger.ts';
import {prepareEntry} from '../lib/v2.ts';
import {createBackup} from '../lib/backup.ts';

const dir = await mkdtemp(join(tmpdir(),'haider-desktop-'));
let server, origin;
const token = 'synthetic-desktop-session';
async function start(){
  const ready = join(dir,'ready');
  server = spawn(process.execPath,['desktop-dist/server.mjs'],{env:{...process.env,HAIDER_DATA:dir,HAIDER_READY:ready,HAIDER_TOKEN:token},stdio:'inherit'});
  for(let retry=0;retry<100;retry++){
    const port = await readFile(ready,'utf8').catch(()=>null);
    if(port){
      origin = 'http://127.0.0.1:'+port;
      await rm(ready);
      return;
    }
    if(server.exitCode!==null) break;
    await delay(50);
  }
  throw Error('Ledger service did not start');
}
async function stop(){
  if(server?.exitCode===null && server?.signalCode===null){
    const exit = once(server,'exit');
    server.kill('SIGTERM');
    await exit;
  }
}
const get = path=>fetch(origin+path,{headers:{'X-Haider-Session':token}});
const post = (path,data,source=origin)=>fetch(origin+path,{
  method:'POST',headers:{'Content-Type':'application/json',Origin:source,'X-Haider-Session':token},body:JSON.stringify(data)
});
const entry = (id,kind,amount)=>({
  id,date:'2026-11-01',month:'2026-11',kind,amount,account:'Alfalah',
  description:id,category:kind==='income'?'Salary':'Food',person:'',notes:'',effects:emptyEffects()
});

try {
  await start();
  assert.equal((await get('/')).status,200);
  assert.equal((await get('/setup/')).status,200);
  assert.equal((await get('/api/unknown')).status,404);
  assert.equal((await fetch(origin+'/api/ledger')).status,403);
  assert.equal((await (await get('/api/setup')).json()).revision,1);
  const clean = (await (await get('/api/ledger')).json()).data;
  assert.deepEqual(clean.entries,[]);
  assert.deepEqual(clean.openings,{Cash:0});
  assert.deepEqual(activeItems(clean,'account'),['Cash']);
  assert.deepEqual(activeItems(clean,'category'),['Food','Transport','Shopping','Health','Misc','Bills','Salary']);
  let original = prepareEntry(emptyLedger('2026-08-01'),entry('salary','income',10000000));
  original = manageLedgerItem(original,'account','Alfalah','rename','Main bank');
  original = manageLedgerItem(original,'account','NBP','archive');
  original = manageLedgerItem(original,'category','Rent','rename','Housing');
  original = manageLedgerItem(original,'category','Gifts','archive');
  const backup = await createBackup(original,8);
  const migration = {confirmation:'MIGRATE',revision:1,backup};
  assert.equal((await post('/api/setup',migration,'https://example.org')).status,403);
  const imported = await post('/api/setup',migration);
  assert.equal(imported.status,200,await imported.clone().text());
  assert.equal((await imported.json()).summary.accounts.Alfalah,10000000);
  assert.equal((await post('/api/setup',migration)).status,400);
  const snapshot = await (await get('/api/ledger')).json();
  assert.ok(activeItems(snapshot.data,'account').includes('Alfalah'));
  assert.ok(activeItems(snapshot.data,'category').includes('Rent'));
  assert.equal(itemName(snapshot.data,'account','Alfalah'),'Main bank');
  assert.equal(itemName(snapshot.data,'category','Rent'),'Housing');
  assert.equal(itemStatus(snapshot.data,'account','NBP'),'archived');
  assert.equal(itemStatus(snapshot.data,'category','Gifts'),'archived');
  const updated = prepareEntry(snapshot.data,entry('lunch','expense',20000));
  const save = {data:updated,revision:snapshot.revision,reason:'Test offline save'};
  const results = await Promise.all([post('/api/ledger',save),post('/api/ledger',save)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  await stop();
  await start();
  const restored = await (await get('/api/ledger')).json();
  assert.equal(restored.revision,3);
  assert.equal(restored.data.entries.length,2);
  assert.equal((await (await get('/api/setup')).json()).summary.accounts.Alfalah,9980000);
  console.log('PASS: local UI, migration, cross-origin block, simultaneous saves, and ledger persistence');
} finally {
  await stop();
  await rm(dir,{recursive:true,force:true});
}
