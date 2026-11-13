import {LEDGER_BYTES} from './backup-limits';
import type {Ledger} from './ledger';
import {normalize,validateState} from './v2';
import {verifyBackup} from './backup';
import {digest,readLedger,stageLedger} from './ledger-store';
import {totals,report} from './ledger';
export function migrationSummary(l:Ledger){const t=totals(l);return {activeTransactions:l.entries.filter(e=>!e.deleted).length,accounts:t.accounts,people:t.people,groupPeople:t.groupPeople,netWorth:t.netWorth,months:Object.fromEntries([...new Set(l.entries.filter(e=>!e.deleted).map(e=>e.month))].sort().map(month=>{const r=report(l,month);return [month,{income:r.income,spend:r.spend,surplus:r.surplus}]}))}}
export async function decodeMigrationBackup(backup:unknown){const text=JSON.stringify(backup);await verifyBackup(text);const parsed=backup as any;const data=validateState(normalize(parsed.format==='haider-backup-v1'?parsed.data:parsed));if(new TextEncoder().encode(JSON.stringify(data)).length>LEDGER_BYTES)throw Error('The restored ledger exceeds the supported save size.');return data}
export async function importFirstLedger(db:D1Database,owner:string,backup:unknown,expectedRevision:number){
 const previous=await db.prepare('SELECT data,revision FROM ledger_versions WHERE owner=? ORDER BY revision DESC LIMIT 1').bind(owner).first<{data:string;revision:number}>();
 const used=await db.prepare('SELECT owner FROM migration_imports WHERE owner=?').bind(owner).first();
 if(used)throw Error('This ledger has already been migrated. File restore is disabled.');
 if(!previous||previous.revision!==expectedRevision||expectedRevision!==1)throw Error('Reload migration status. Migration is allowed only into the initial empty ledger.');
 const old=await readLedger(db,owner,previous.data);
 if(old.entries.length||old.audit?.length||Object.values(old.openings).some(Boolean)||Object.keys(old.openingPeople).length)throw Error('This ledger already contains records or balances. It cannot be replaced.');
 const data=await decodeMigrationBackup(backup),stored=await stageLedger(db,owner,data),at=new Date().toISOString(),hash=await digest(JSON.stringify(backup));
 const results=await db.batch([
 db.prepare('INSERT INTO ledger_versions (owner,revision,data,created_at,reason) SELECT ?,2,?,?,? WHERE (SELECT MAX(revision) FROM ledger_versions WHERE owner=?)=1 AND NOT EXISTS (SELECT 1 FROM migration_imports WHERE owner=?)').bind(owner,stored,at,'One-time personal hosting migration',owner,owner),
 db.prepare('INSERT INTO migration_imports (owner,backup_hash,created_at,revision) SELECT ?,?,?,2 WHERE EXISTS (SELECT 1 FROM ledger_versions WHERE owner=? AND revision=2 AND data=?)').bind(owner,hash,at,owner,stored)
 ]);
 if(!results[0].meta.changes)throw Error('The ledger changed. Reload before migrating.');
 return {revision:2,summary:migrationSummary(data),backupHash:hash};
}
