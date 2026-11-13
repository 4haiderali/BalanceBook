import {REQUEST_BYTES} from '../../../lib/backup-limits';
import {env} from 'cloudflare:workers';
import {getOwner,requireSameOrigin} from '../../../lib/personal-auth';
import {readLedger} from '../../../lib/ledger-store';
import {importFirstLedger,migrationSummary} from '../../../lib/first-migration';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){const owner=await getOwner(request,env);if(!owner)return json({error:'Sign in first.'},401);const row=await env.DB!.prepare('SELECT data,revision FROM ledger_versions WHERE owner=? ORDER BY revision DESC LIMIT 1').bind(owner.userId).first<{data:string;revision:number}>();const migrated=await env.DB!.prepare('SELECT created_at,backup_hash FROM migration_imports WHERE owner=?').bind(owner.userId).first();return json({enabled:env.MIGRATION_ENABLED==='true',revision:row?.revision||0,migrated,summary:row?migrationSummary(await readLedger(env.DB!,owner.userId,row.data)):null})}
export async function POST(request:Request){try{requireSameOrigin(request);const owner=await getOwner(request,env);if(!owner)return json({error:'Sign in first.'},401);if(env.MIGRATION_ENABLED!=='true')return json({error:'Migration is disabled.'},403);const text=await request.text();if(new TextEncoder().encode(text).length>REQUEST_BYTES)return json({error:'File too large.'},413);const body=JSON.parse(text);if(body.confirmation!=='MIGRATE'||body.revision!==1)return json({error:'Confirm the initial migration.'},400);return json(await importFirstLedger(env.DB!,owner.userId,body.backup,body.revision));}catch(e){return json({error:e instanceof Error?e.message:'Migration failed. Previous records were not replaced.'},400)}}
