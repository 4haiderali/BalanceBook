import {LEDGER_BYTES} from '../../../lib/backup-limits';
import { env } from 'cloudflare:workers';
import {getOwner,requireSameOrigin} from '../../../lib/personal-auth';
import {emptyLedger,newDesktopLedger} from '../../../lib/empty-ledger';
import {readLedger,stageLedger} from '../../../lib/ledger-store';
import { type Ledger } from '../../../lib/ledger';
import {normalize} from '../../../lib/v2';
import {prepareWrite} from '../../../lib/write-request';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
type LedgerRow = { data:string; revision:number; created_at:string };

export async function GET(request:Request){
 const db=env.DB;
 if(!db)return response({error:'Database unavailable.'},503);
 try{
  const user=await getOwner(request,env);
  if(!user)return response({error:'Sign in to access your ledger.'},401);
  const url=new URL(request.url);
  if(url.searchParams.has('history')){
   const history=await db.prepare('SELECT revision, created_at, reason FROM ledger_versions WHERE owner=? ORDER BY revision DESC LIMIT 30').bind(user.userId).all();
   return response({history:history.results});
  }
  const desktop=(env as typeof env & {DESKTOP_LOCAL?:boolean}).DESKTOP_LOCAL;
  const revision=url.searchParams.get('revision');
  const latest=()=>db.prepare('SELECT data,revision,created_at FROM ledger_versions WHERE owner=? ORDER BY revision DESC LIMIT 1').bind(user.userId).first<LedgerRow>();
  let row=revision
   ? await db.prepare('SELECT data,revision,created_at FROM ledger_versions WHERE owner=? AND revision=?').bind(user.userId,Number(revision)).first<LedgerRow>()
   : await latest();
  if(!row){
   if(revision)return response({error:'Backup not found.'},404);
   await db.prepare('INSERT OR IGNORE INTO ledger_versions (owner,revision,data,created_at,reason) VALUES (?,1,?,?,?)').bind(user.userId,JSON.stringify(desktop?newDesktopLedger():emptyLedger()),new Date().toISOString(),'New empty ledger').run();
   row=await latest();
   if(!row)throw Error('Could not load the initial ledger.');
  }
  const verifiedBlocks=new Set<string>();
  let data=normalize(await readLedger(db,user.userId,row.data,verifiedBlocks));
  let setupWarning:string|undefined;
  return response({data,setupWarning,revision:row.revision,savedAt:row.created_at});
 }catch(e){
  console.error('Ledger load failed',e);
  return response({error:'The server could not load your ledger. Try again in a moment.'},503);
 }
}
export async function POST(request:Request){
 const timings:string[]=[];
 let started=performance.now();
 function measure(step:string){
  const now=performance.now();
  timings.push(step+';dur='+(now-started).toFixed(1));
  started=now;
 }
 const user=await getOwner(request,env);measure('auth');if(!user)return response({error:'Your session ended. Sign in in another tab, then retry saving. Keep this form open.'},401);
 try{requireSameOrigin(request)}catch{return response({error:'Invalid origin or insecure connection.'},403);}
 if(!env.DB)return response({error:'Database unavailable.'},503);
 try{
 const body=await request.text();if(new TextEncoder().encode(body).length>LEDGER_BYTES)return response({error:'The ledger exceeds the supported save size.'},413);
 const {data:incoming,revision,reason,operation='save',restoreRevision}=JSON.parse(body);let data:Ledger;if(!Number.isSafeInteger(revision)||revision<0)throw Error('Invalid revision.');
 measure('body');
 const prior=await env.DB.prepare('SELECT data,revision FROM ledger_versions WHERE owner=? ORDER BY revision DESC LIMIT 1').bind(user.userId).first<any>();
 if((prior?.revision||0)!==revision)return response({error:'The ledger changed since this draft opened.'},409);
 if(operation!=='save')throw Error('File import and whole-ledger restore are disabled. Existing transactions are retained.');
 const verifiedBlocks=new Set<string>();
 const previous=prior?await readLedger(env.DB,user.userId,prior.data,verifiedBlocks):emptyLedger();
 measure('load');
 if((env as typeof env & {DESKTOP_LOCAL?:boolean}).DESKTOP_LOCAL&&Array.isArray(incoming?.entries)){
  const people=new Map(normalize(previous).people!.map(p=>[p.key,p]));
  const entries=new Map(previous.entries.map(e=>[e.id,e]));
  const keys=(entry:Ledger['entries'][number]|undefined)=>entry
   ?[entry.person,...(entry.splits||[]).map(s=>s.person),...(entry.group?.assignments||[]).map(a=>a.person)].filter(Boolean)
   :[];
  for(const entry of incoming.entries){
   const retained=new Set(keys(entries.get(entry.id)));
   for(const key of keys(entry)){
    const person=people.get(key);
    if(!retained.has(key)&&(!person||person.archived||person.notPerson||person.mergedInto))
     throw Error('Select an existing person. To create one, use People → Add person.');
   }
  }
 }
 const prepared=await prepareWrite(previous,{data:incoming,revision,reason,operation,restoreRevision} as any,async selected=>{
 const snapshot=await env.DB!.prepare('SELECT data FROM ledger_versions WHERE owner=? AND revision=?').bind(user.userId,selected).first<any>();return snapshot?await readLedger(env.DB!,user.userId,snapshot.data):null;
 });data=prepared.data;const savedReason=prepared.reason;
 if(new TextEncoder().encode(JSON.stringify(data)).length>LEDGER_BYTES)return response({error:'This save would exceed the supported backup size.'},413);
 measure('validate');
 const savedAt=new Date().toISOString();
 const stored=await stageLedger(env.DB,user.userId,data,verifiedBlocks);
 measure('stage');
 // Atomic optimistic append: a concurrent edit cannot overwrite a newer revision.
 const result=await env.DB.prepare('INSERT INTO ledger_versions (owner,revision,data,created_at,reason) SELECT ?,?,?,?,? WHERE COALESCE((SELECT MAX(revision) FROM ledger_versions WHERE owner=?),0)=?').bind(user.userId,revision+1,stored,savedAt,savedReason.slice(0,200),user.userId,revision).run();
 if(!result.meta.changes)return response({error:'The ledger changed since this draft opened.'},409);
 measure('commit');
 const resultResponse=response({revision:revision+1,savedAt,data});
 resultResponse.headers.set('Server-Timing',timings.join(', '));
 return resultResponse;
 }catch(e){if(String(e).includes('UNIQUE constraint'))return response({error:'The ledger changed since this draft opened.'},409);return response({error:e instanceof Error?e.message:'Unable to save.'},400)}
}
