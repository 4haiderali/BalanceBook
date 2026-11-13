import {BACKUP_BYTES} from './backup-limits';
import type {Ledger} from './ledger';
import {validateState} from './v2';
import {digest} from './ledger-store';
export async function createBackup(data:Ledger,revision:number){return {format:'haider-backup-v1',createdAt:new Date().toISOString(),revision,sha256:await digest(JSON.stringify(data)),data}}
// Checking a file is read-only. Never calls the save API or restores the ledger.
export async function verifyBackup(text:string){
 if(new TextEncoder().encode(text).length>BACKUP_BYTES)throw Error('Backup is too large to check here.');
 const parsed=JSON.parse(text),envelope=parsed.format==='haider-backup-v1';
 const data:Ledger=envelope?parsed.data:parsed;
 if(envelope&&await digest(JSON.stringify(data))!==parsed.sha256)throw Error('Backup checksum does not match. Keep your other copies.');
 validateState(data);
 return {entries:data.entries.filter(e=>!e.deleted).length,audit:data.audit?.length||0,checksum:envelope,revision:envelope?parsed.revision:null};
}
