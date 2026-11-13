import {isMainThread,parentPort,workerData} from 'node:worker_threads';
import {writeReportFiles} from './report-files';
import {createReportService} from './report-service.mjs';
import {env} from 'cloudflare:workers';
import {timingSafeEqual} from 'node:crypto';
import {REQUEST_BYTES, BACKUP_BYTES} from '../lib/backup-limits';
import {verifyBackup} from '../lib/backup';
import {importFirstLedger} from '../lib/first-migration';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir, readdir, readFile, rename, stat, writeFile} from 'node:fs/promises';
import {join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import * as ledger from '../app/api/ledger/route';
import * as setup from '../app/api/setup/route';

if(!isMainThread&&workerData?.reportExport){
  try { parentPort.postMessage({result:await writeReportFiles(workerData.reportExport)}); }
  catch(error){ parentPort.postMessage({error:error instanceof Error?error.message:String(error)}); }
  process.exit(0);
}

const [mode, backupPath] = process.argv.slice(2);
async function readBackup(){
  if ((await stat(backupPath)).size > BACKUP_BYTES) throw Error('Backup exceeds 64 MiB.');
  return readFile(backupPath, 'utf8');
}
if (mode === '--verify-backup'){
  const checked = await verifyBackup(await readBackup());
  if (!checked.checksum) throw Error('This export has no checksum.');
  console.log(JSON.stringify(checked));
  process.exit(0);
}
const {HAIDER_DATA, HAIDER_READY, HAIDER_PARENT, HAIDER_TOKEN} = process.env;
const restoring = mode === '--restore-backup';
if (!HAIDER_DATA || (!restoring && (!HAIDER_READY || !HAIDER_TOKEN))) throw Error('Missing desktop launcher settings.');
const base = fileURLToPath(new URL('.', import.meta.url));
const web = resolve(base, 'web');
await mkdir(HAIDER_DATA, {recursive:true});
const db = new DatabaseSync(join(HAIDER_DATA, 'ledger.sqlite'));
db.exec('PRAGMA synchronous=FULL');
const migrations = (await readdir(join(base, 'drizzle'))).filter(file=>file.endsWith('.sql')).sort();
const version = db.prepare('PRAGMA user_version').get().user_version;
if (version > migrations.length) throw Error('This ledger requires a newer version of BalanceBook.');

function transaction(run){
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = run();
    db.exec('COMMIT');
    return result;
  } catch(error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

for (let i=version; i<migrations.length; i++){
  const sql = await readFile(join(base, 'drizzle', migrations[i]), 'utf8');
  transaction(()=>{
    db.exec(sql);
    db.exec(`PRAGMA user_version=${i+1}`);
  });
}

env.DB = {
  prepare(sql){
    const statement = db.prepare(sql);
    return {bind(...args){
      return {
        first:()=>statement.get(...args) ?? null,
        all:()=>({results:statement.all(...args)}),
        run:()=>({meta:{changes:statement.run(...args).changes}}),
      };
    }};
  },
  batch(statements){return transaction(()=>statements.map(statement=>statement.run()));},
};

if (restoring){
  try {
    const response = await ledger.GET(new Request('http://localhost/api/ledger'));
    if (!response.ok) throw Error('The recovery database could not be initialized.');
    const result = await importFirstLedger(env.DB, 'local-haider', JSON.parse(await readBackup()), 1);
    const {activeTransactions, accounts, netWorth, people, groupPeople, months} = result.summary;
    const pkr = value => 'PKR ' + (value / 100).toLocaleString('en-PK', {maximumFractionDigits:2});
    const personal = Object.values(people);
    console.log([
      activeTransactions + ' active transactions across ' + Object.keys(months).length + ' report months',
      'Tracked net worth: ' + pkr(netWorth),
      ...Object.entries(accounts).slice(0, 10).map(([name, amount]) => name + ': ' + pkr(amount)),
      'People owe you: ' + pkr(personal.reduce((sum, item) => sum + item.receivable, 0)),
      'You owe people: ' + pkr(personal.reduce((sum, item) => sum + item.payable, 0)),
      'Group due: ' + pkr(Object.values(groupPeople).reduce((sum, amount) => sum + amount, 0)),
    ].join('\n'));
  } finally {
    db.close();
  }
  process.exit(0);
}

const expectedToken = Buffer.from(HAIDER_TOKEN);
const reports=createReportService(process.env.HAIDER_REPORT_CONFIG,async()=>{
  const response=await ledger.GET(new Request(origin+'/api/ledger'));
  if(!response.ok)throw Error('Could not read the saved ledger for export.');
  return response.json();
});
const routes = new Map([['/api/ledger',ledger],['/api/setup',setup],['/api/reports',reports]]);
const contentTypes = new Map([
  ['html','text/html; charset=utf-8'],['js','text/javascript; charset=utf-8'],
  ['css','text/css; charset=utf-8'],['png','image/png'],['svg','image/svg+xml'],
  ['webmanifest','application/manifest+json'],['woff2','font/woff2'],['ico','image/x-icon'],
]);
const json = (res,status,error)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error}));

const server = createServer(async (req,res)=>{
  try {
    if(req.headers.host !== address || !req.url?.startsWith('/') || req.url.startsWith('//') ||
       req.headers['sec-fetch-site']==='cross-site'){
      return json(res,403,'Open BalanceBook from its desktop shortcut.');
    }
    const url = new URL(req.url, origin);
    if(url.origin !== origin) return json(res,403,'Invalid local URL.');
    const path = decodeURIComponent(url.pathname);
    const route = routes.get(path);
    if(route){
      const token = Buffer.from(String(req.headers['x-haider-session'] ?? ''));
      if (token.length !== expectedToken.length || !timingSafeEqual(token, expectedToken))
        return json(res,403,'Open BalanceBook from its desktop shortcut.');
      if(req.method!=='GET' && req.method!=='POST') return json(res,405,'Method not allowed.');
      const headers = new Headers(req.headers);
      let body;
      if(req.method==='POST'){
        if(headers.get('origin')!==origin) return json(res,403,'Request must come from BalanceBook.');
        const chunks = [];
        let bytes = 0;
        for await(const chunk of req){
          bytes += chunk.length;
          if(bytes <= REQUEST_BYTES) chunks.push(chunk);
        }
        if(bytes > REQUEST_BYTES) return json(res,413,'File too large.');
        body = Buffer.concat(chunks);
      }
      const response = await route[req.method](new Request(url,{method:req.method,headers,body}));
      if(response.ok&&req.method==='POST'&&(route===ledger||route===setup))reports.queue();
      const payload = Buffer.from(await response.arrayBuffer());
      res.writeHead(response.status,Object.fromEntries(response.headers)).end(payload);
      return;
    }
    if(req.method!=='GET' && req.method!=='HEAD') return json(res,405,'Method not allowed.');
    const relative = path==='/' ? '/index.html' : ['/setup','/setup/'].includes(path) ? '/setup/index.html' : path;
    const file = resolve(web,'.'+relative);
    if(!file.startsWith(web+sep)) return json(res,404,'File not found.');
    const contentType = contentTypes.get(file.split('.').at(-1));
    if(!contentType) return json(res,404,'File not found.');
    const info = await stat(file).catch(()=>null);
    if(!info?.isFile()) return json(res,404,'File not found.');
    res.writeHead(200,{
      'Content-Type':contentType,'Content-Length':info.size,'X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
      'Cache-Control':'no-store',
    });
    if(req.method==='HEAD') res.end();
    else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  } catch (error) {
    console.error(error);
    if(res.headersSent) res.destroy();
    else json(res,500,'BalanceBook could not complete that request.');
  }
});

await new Promise((ready,fail)=>server.once('error',fail).listen(0,'127.0.0.1',ready));
const {port} = server.address();
const address = `127.0.0.1:${port}`;
const origin = 'http://'+address;
await stat(join(web, 'index.html'));
const integrity = db.prepare('PRAGMA quick_check').all();
if (integrity.some(row => row.quick_check !== 'ok')) throw Error('SQLite integrity check failed.');
const initial = await ledger.GET(new Request(origin+'/api/ledger'));
if(!initial.ok) throw Error('The local ledger could not be opened.');
await writeFile(HAIDER_READY+'.tmp',String(port),{flag:'wx'});
await rename(HAIDER_READY+'.tmp',HAIDER_READY);
reports.start();

let stopping = false;
function stop(){
  if(stopping) return;
  stopping = true;
  server.close(async()=>{await reports.close();db.close();process.exit(0);});
}
process.on('SIGINT',stop);
process.on('SIGTERM',stop);
if(HAIDER_PARENT){
  process.stdin.resume();
  process.stdin.on('end',stop);
  setInterval(()=>{
    try {process.kill(Number(HAIDER_PARENT),0);}
    catch(error){if(error.code==='ESRCH') stop();}
  },2000).unref();
}
