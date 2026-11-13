import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,mkdtemp,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import * as XLSX from 'xlsx';
import {emptyLedger} from '../lib/empty-ledger.ts';
import {emptyEffects} from '../lib/ledger.ts';
import {prepareEntry} from '../lib/v2.ts';
import {createBackup,verifyBackup} from '../lib/backup.ts';
import {writeReportFiles} from './report-files.ts';

const root=await mkdtemp(join(tmpdir(),'haider-reports-'));
const first=join(root,'first'),second=join(root,'second'),config=join(root,'folder.txt'),ready=join(root,'ready');
const token='report-test';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
await mkdir(first);
await mkdir(second);
await writeFile(config,first);
const child=spawn(process.execPath,['desktop-dist/server.mjs'],{env:{...process.env,HAIDER_DATA:join(root,'data'),HAIDER_READY:ready,HAIDER_TOKEN:token,HAIDER_REPORT_CONFIG:config},stdio:'inherit'});
let origin;
async function waitFor(fn){
 for(let n=0;n<200;n++){
  const result=await fn();
  if(result)return result;
  await delay(50);
 }
 throw Error('Timed out waiting for export');
}
const api=async(path,body)=>{
 const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{'X-Haider-Session':token,...body&&{Origin:origin,'Content-Type':'application/json'}},body:body&&JSON.stringify(body)});
 assert.ok(r.ok,await r.clone().text());
 return r.json();
};
const workbook=async file=>XLSX.read(await readFile(file),{type:'buffer'});
const has=async file=>stat(file).then(()=>true,()=>false);
const entry=(id,month,kind,amount)=>({id,date:month+'-15',month,kind,amount,account:'Alfalah',description:id,category:kind==='income'?'Salary':'Food',person:'',notes:'',effects:emptyEffects()});
const available=async(folder,minimum)=>waitFor(async()=>{
 const status=await api('/api/reports');
 if(status.folder===folder&&!status.running&&status.at&&!status.errors.length&&status.written>=minimum){
  return status;
 }
});
try{
 const port=await waitFor(()=>readFile(ready,'utf8').catch(()=>null));
 origin='http://127.0.0.1:'+port;
 assert.equal((await fetch(origin+'/api/reports')).status,403);
 const initialStatus=await available(first,4);
 assert.equal(initialStatus.backup.revision,1);
 assert.equal((await verifyBackup(await readFile(initialStatus.backup.path,'utf8'))).revision,1);
 const seed=prepareEntry(prepareEntry(emptyLedger('2024-01-01'),entry('old income','2024-12','income',500000)),entry('old expense','2025-01','expense',12500));
 await api('/api/setup',{backup:await createBackup(seed,7),confirmation:'MIGRATE',revision:1});
 await waitFor(()=>has(join(first,'Summaries','2025 Summary.xlsx')));
 const importedStatus=await waitFor(async()=>{const s=await api('/api/reports');return !s.running&&s.written>=6&&s;});
 const importedLedger=await api('/api/ledger');
 assert.equal(importedStatus.backup.revision,importedLedger.revision);
 assert.equal((await verifyBackup(await readFile(importedStatus.backup.path,'utf8'))).revision,importedLedger.revision);
 const reportFile=join(first,'Monthly','2025-01.xlsx'),older=join(first,'Monthly','2024-12.xlsx');
 assert.equal((await workbook(reportFile)).Sheets['Month Totals'].B2.v,125);
 const monthly=await workbook(reportFile);
 assert.equal(monthly.SheetNames[0],'Summary');
 assert.equal(monthly.Sheets.Summary.B8.v,125);
 assert.equal(monthly.Sheets.Summary.C7.v,5000);
 assert.equal(monthly.Sheets.Transactions.A4.t,'n');
 assert.equal(monthly.Sheets.Transactions.D4.v,125);
 assert.match(monthly.Sheets.Transactions['!autofilter'].ref,/^A3:/);
 const monthZip=XLSX.CFB.read(await readFile(reportFile),{type:'buffer'});
 const transactionsXml=Buffer.from(XLSX.CFB.find(monthZip,'/xl/worksheets/sheet2.xml').content).toString();
 assert.match(transactionsXml,/<pane ySplit="3".*state="frozen"/);
 assert.match(transactionsXml,/hidden="(?:1|true)"/);
 assert.ok(XLSX.utils.sheet_to_json(monthly.Sheets['Closing balances'],{header:1}).some(row=>row[0]==='Alfalah'&&row[1]===4875));
 const activeMonth=join(first,'Monthly',today.slice(0,7)+'.xlsx');

 const summaryFile=join(first,'Summaries','2025 Summary.xlsx');
 assert.equal((await workbook(summaryFile)).Sheets['Year Summary'].C2.v,125);
 const zip=XLSX.CFB.read(await readFile(summaryFile),{type:'buffer'});
 assert.match(Buffer.from(XLSX.CFB.find(zip,'/xl/worksheets/sheet1.xml').content).toString(),/conditionalFormatting/);
 const previousTime=(await stat(older)).mtimeMs;
 const snapshot=await api('/api/ledger');
 const old=snapshot.data.entries.find(e=>e.id==='old expense');
 const edited=prepareEntry(snapshot.data,{...old,amount:17500},old);
 const saved=await api('/api/ledger',{data:edited,revision:snapshot.revision,reason:'Corrected previous January'});
 await waitFor(async()=> (await workbook(reportFile)).Sheets['Month Totals'].B2.v===175);
 await waitFor(async()=>{const s=await api('/api/reports');return !s.running&&s;});
 assert.equal((await stat(older)).mtimeMs,previousTime);
 assert.equal((await workbook(join(first,'Yearly','2025.xlsx'))).Sheets['Monthly Totals'].C2.v,175);
 assert.equal((await workbook(summaryFile)).Sheets['Year Summary'].C2.v,175);
 await waitFor(async()=>XLSX.utils.sheet_to_json((await workbook(activeMonth)).Sheets['Closing balances'],{header:1})
  .some(row=>row[0]==='Alfalah'&&row[1]===4825));

 const verified=await verifyBackup(await readFile(join(first,'Backups','Haider_Money_'+today+'.json'),'utf8'));
 assert.equal(verified.revision,saved.revision);

 await rm(older);
 await rm(summaryFile);
 await api('/api/reports',{rebuild:false});
 await waitFor(async()=>await has(older)&&await has(summaryFile));
 await available(first,2);
 await writeFile(config,second);
 await api('/api/reports',{rebuild:false});
 await available(second,7);
 assert.ok(await has(join(second,'Monthly','2024-12.xlsx')));
 assert.ok(await has(join(second,'Yearly','2025.xlsx')));
 assert.ok(await has(join(second,'Summaries','2025 Summary.xlsx')));
 assert.equal((await verifyBackup(await readFile(join(second,'Backups','Haider_Money_'+today+'.json'),'utf8'))).revision,saved.revision);

 await rename(second,second+'-away');
 await api('/api/reports',{rebuild:true});
 await waitFor(async()=>{const s=await api('/api/reports');return s.errors.length&&s;});
 assert.equal(await has(second),false);
 assert.equal((await api('/api/ledger')).revision,saved.revision);
 await rename(second+'-away',second);
 await api('/api/reports',{rebuild:true});
 await available(second,7);
 console.log('PASS: automatic exports, styled Excel summary, historical correction, missing files, folder change, retry, and verified JSON');

 // Move the only entry out of January while exporting elsewhere, then revisit
 // the old folder. Both the old month and old year should become empty.
 const beforeMove=await api('/api/ledger');
 const january=beforeMove.data.entries.find(e=>e.id==='old expense');
 const moved=prepareEntry(beforeMove.data,{...january,month:'2026-11'},january);
 await api('/api/ledger',{data:moved,revision:beforeMove.revision,reason:'Moved January report month'});
 await waitFor(async()=> (await workbook(join(second,'Monthly','2025-01.xlsx'))).Sheets['Month Totals'].B2.v===0);
 await waitFor(async()=>{const s=await api('/api/reports');return !s.running&&s;});
 assert.equal((await workbook(reportFile)).Sheets['Month Totals'].B2.v,175);
 const unrelated=join(first,'Monthly','personal.xlsx');
 await writeFile(unrelated,'leave this file alone');
 await writeFile(config,first);
 await api('/api/reports',{rebuild:true});
 await available(first,7);
 assert.equal((await workbook(reportFile)).Sheets['Month Totals'].B2.v,0);
 assert.equal((await workbook(join(first,'Yearly','2025.xlsx'))).Sheets['Monthly Totals'].C2.v,0);
 assert.equal((await workbook(summaryFile)).Sheets['Year Summary'].C2.v,0);
 assert.equal(await readFile(unrelated,'utf8'),'leave this file alone');
 console.log('PASS: revisiting a previous folder refreshes periods emptied while away');

 const retention=join(root,'retention');
 await mkdir(retention);
 let previous;
 for(const date of ['2025-12-30','2025-12-31','2026-01-01','2026-01-02','2026-01-03','2026-01-04','2026-01-05','2026-01-06','2026-01-07','2026-01-08']){
  const result=await writeReportFiles({folder:retention,ledger:seed,revision:7,today:date,previous,force:false});
  assert.deepEqual(result.errors,[]);
  previous=result.state;
 }
 assert.ok(await has(join(retention,'Backups','Haider_Money_2025-12-31.json')));
 assert.equal(await has(join(retention,'Backups','Haider_Money_2025-12-30.json')),false);
 assert.equal(await has(join(retention,'Backups','Haider_Money_2026-01-01.json')),false);
 assert.ok(await has(join(retention,'Monthly','2026-01.xlsx')));
 assert.ok(await has(join(retention,'Yearly','2026.xlsx')));
 console.log('PASS: month and year rollover and retention of seven daily backups plus a completed-month copy');
}finally{
 if(child.exitCode===null&&child.signalCode===null){const exit=once(child,'exit');child.kill('SIGTERM');await exit;}
 await rm(root,{recursive:true,force:true});
}
