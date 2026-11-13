import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp, readFile, rm, writeFile, copyFile, truncate} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createBackup} from '../lib/backup.ts';
import {emptyLedger} from '../lib/empty-ledger.ts';
import {emptyEffects, totals, report} from '../lib/ledger.ts';
import {prepareEntry, deleteEntry} from '../lib/v2.ts';

const previousServer = process.argv[2] && resolve(process.argv[2]);
const server = resolve('desktop-dist/server.mjs');
const dir = await mkdtemp(join(tmpdir(),'haider-recovery-'));
const token = 'synthetic-upgrade-check';
const live = join(dir,'live');
const candidate = join(dir,'candidate');
let child, origin;

async function start(script, data) {
  const ready = join(dir,'ready');
  child = spawn(process.execPath,[script],{
    env:{...process.env,HAIDER_DATA:data,HAIDER_READY:ready,HAIDER_TOKEN:token,HAIDER_PARENT:String(process.pid)},
    stdio:['pipe','ignore','inherit'],
  });
  for(let retry=0;retry<160;retry++){
    const port = await readFile(ready,'utf8').catch(()=>null);
    if(port){
      origin = 'http://127.0.0.1:'+port;
      await rm(ready);
      return;
    }
    if(child.exitCode!==null)break;
    await delay(25);
  }
  throw Error('Service failed to start');
}
async function stop(){
  if(child?.exitCode===null&&child?.signalCode===null){
    const exit = once(child,'exit');
    child.stdin.end();
    assert.deepEqual(await exit,[0,null]);
  }
}
async function api(path,body){
  const r=await fetch(origin+path,{
    method:body?'POST':'GET',
    headers:{'X-Haider-Session':token,...body&&{'Content-Type':'application/json',Origin:origin}},
    body:body&&JSON.stringify(body),
  });
  assert.equal(r.status,200,await r.clone().text());
  return r.json();
}
function run(mode,path,data){
  return new Promise((resolve,reject)=>{
    const processChild=spawn(process.execPath,[server,mode,path],{
      env:{...process.env,HAIDER_DATA:data},stdio:['ignore','pipe','pipe'],
    });
    let output='',errors='';
    processChild.stdout.on('data',chunk=>output+=chunk);
    processChild.stderr.on('data',chunk=>errors+=chunk);
    processChild.once('error',reject);
    processChild.once('close',code=>resolve({code,output,errors}));
  });
}
const transaction=(id,kind,amount)=>({
  id,kind,amount,date:'2026-11-05',month:'2026-10',category:kind==='income'?'Salary':'Food',
  description:id,account:'Alfalah',person:'',notes:'',effects:emptyEffects()
});

try {
  await start(previousServer||server,live);
  const initial=await api('/api/ledger');
  const income=prepareEntry(emptyLedger('2026-08-01'),transaction('October salary','income',2000000));
  let mixed=prepareEntry(income,transaction('Stationery','expense',25000));
  mixed=prepareEntry(mixed,{...transaction('Transfer to cash','transfer',10000),to:'Cash'});
  mixed=prepareEntry(mixed,{...transaction('Loan','lend',20000),person:'Test borrower'});
  mixed=prepareEntry(mixed,{...transaction('Loan repayment','repaymentIn',5000),person:'Test borrower'});
  mixed=prepareEntry(mixed,{...transaction('Group payment','groupPayment',120000),person:'Test payee',
    group:{loanUsed:0,selfFunded:20000,assignments:[{id:'assignment',person:'Test reimburser',amount:100000}]}});
  mixed=prepareEntry(mixed,{...transaction('Group receipt','groupReceipt',40000),person:'Test reimburser',
    receipt:{groupId:'Group payment',assignmentId:'assignment'}});
  await api('/api/setup',{backup:await createBackup(mixed,7),confirmation:'MIGRATE',revision:initial.revision});
  const before=await api('/api/ledger');
  const original=before.data.entries.find(e=>e.id==='Stationery');
  const edited=prepareEntry(before.data,{...original,amount:30000},original);
  const correction=await api('/api/ledger',{data:edited,revision:before.revision,reason:'Corrected amount'});
  const deleted=await api('/api/ledger',{
    data:deleteEntry(correction.data,original.id),revision:correction.revision,reason:'Removed duplicate',
  });
  const history=await api('/api/ledger?history=1');
  await stop();
  const database=join(live,'ledger.sqlite');
  const beforeBytes=await readFile(database);

  await start(server,live);
  const updated=await api('/api/ledger');
  assert.deepEqual(updated,deleted);
  assert.deepEqual(await api('/api/ledger?history=1'),history);
  assert.deepEqual((await api('/api/ledger?revision=3')).data,correction.data);
  await stop();
  assert.deepEqual(await readFile(database),beforeBytes);
  console.log('PASS: existing SQLite file, latest revision, earlier revisions, correction, audit and tombstone survive replacement');

  const backup=await createBackup(updated.data,updated.revision);
  const backupFile=join(dir,'export.json');
  await writeFile(backupFile,JSON.stringify(backup));
  assert.equal((await run('--verify-backup',backupFile,candidate)).code,0);
  const badFile=join(dir,'bad.json');
  await writeFile(badFile,JSON.stringify({...backup,sha256:'bad'}));
  const invalid=await run('--restore-backup',badFile,join(dir,'invalid'));
  assert.notEqual(invalid.code,0);
  assert.match(invalid.errors,/checksum does not match/i);
  const recovered=await run('--restore-backup',backupFile,candidate);
  assert.equal(recovered.code,0,recovered.errors);
  assert.match(recovered.output,/6 active transactions/);
  assert.deepEqual(await readFile(database),beforeBytes);
  await start(server,candidate);
  const restored=await api('/api/ledger');
  assert.deepEqual(restored.data,updated.data);
  assert.deepEqual(totals(restored.data),totals(updated.data));
  assert.deepEqual(report(restored.data,'2026-10'),report(updated.data,'2026-10'));
  await stop();
  console.log('PASS: checksum verification, bad-backup rejection, separate recovery database and exact restored snapshot');

  // A read failure must never turn a damaged existing file into an empty ledger.
  await copyFile(database,join(candidate,'ledger.sqlite'));
  await writeFile(join(candidate,'ledger.sqlite'),'synthetic corrupt file');
  await assert.rejects(start(server,candidate),/failed to start/);
  assert.equal(await readFile(join(candidate,'ledger.sqlite'),'utf8'),'synthetic corrupt file');
  assert.deepEqual(await readFile(database),beforeBytes);
  console.log('PASS: corrupt database startup fails without overwriting the damaged or live file');

  const largeData=join(dir,'large');
  const largeLedger={...emptyLedger('2026-08-01'),audit:Array.from({length:3500},(_,i)=>({
    id:'audit-'+i,at:'2026-11-05T12:00:00Z',action:'Edited',target:'test-'+i,reason:'Synthetic size fixture',
    before:{...transaction('test-'+i,'expense',10000),notes:'a'.repeat(1900)},
    after:{...transaction('test-'+i,'expense',10000),notes:'b'.repeat(1900)},
  }))};
  const largeBackup=await createBackup(largeLedger,8);
  assert.ok(Buffer.byteLength(JSON.stringify(largeBackup))>12_000_000);
  await start(server,largeData);
  await api('/api/setup',{backup:largeBackup,confirmation:'MIGRATE',revision:1});
  const largeSnapshot=await api('/api/ledger');
  assert.equal(largeSnapshot.data.audit.length,3500);
  const appended=prepareEntry(largeSnapshot.data,transaction('New expense','expense',12500));
  const largeSaved=await api('/api/ledger',{data:appended,revision:largeSnapshot.revision,reason:'Check larger ledger'});
  assert.equal(largeSaved.data.entries.length,1);
  await stop();
  const largeExport=join(dir,'large.json');
  await writeFile(largeExport,JSON.stringify(await createBackup(largeSaved.data,largeSaved.revision)));
  assert.equal((await run('--verify-backup',largeExport,largeData)).code,0);
  await truncate(largeExport,64*1024*1024+1);
  const oversized=await run('--verify-backup',largeExport,largeData);
  assert.notEqual(oversized.code,0);
  assert.match(oversized.errors,/exceeds 64 MiB/);
  console.log('PASS: larger-than-12 MB ledger can import, save and export; oversized file is rejected');

} finally {
  await stop();
  await rm(dir,{recursive:true,force:true});
}
