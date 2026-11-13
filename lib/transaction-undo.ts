import {reflow,type Entry,type Ledger} from './ledger';
import {deleteEntry} from './v2';

export const UNDO_MS=60_000;
export type TransactionUndo={revision:number;expires:number;entry:Entry;before?:Entry};

export function createTransactionUndo(before:Ledger,after:Ledger,revision:number,now=Date.now()):TransactionUndo|null{
 const {entries:previous,audit:_oldAudit,...oldMetadata}=before;
 const {entries:current,audit:_newAudit,...newMetadata}=after;
 if(JSON.stringify(oldMetadata)!==JSON.stringify(newMetadata)||current.length<previous.length)return null;
 const byId=new Map(previous.map(entry=>[entry.id,entry]));
 const changed=current.filter(entry=>JSON.stringify(entry)!==JSON.stringify(byId.get(entry.id)));
 if(changed.length!==1)return null;
 const entry=changed[0],original=byId.get(entry.id);
 if(current.length!==previous.length+(original?0:1))return null;
 return {revision,expires:now+UNDO_MS,entry,before:original};
}

export function undoTransaction(ledger:Ledger,undo:TransactionUndo,revision:number,now=Date.now()){
 if(revision!==undo.revision||now>=undo.expires)throw Error('This Undo is no longer available.');
 const entry=ledger.entries.find(row=>row.id===undo.entry.id);
 if(!entry||JSON.stringify(entry)!==JSON.stringify(undo.entry))throw Error('This transaction has changed.');
 if(!undo.before)return deleteEntry(ledger,entry.id);
 const restored=entry.original?{...undo.before,original:entry.original}:undo.before;
 return reflow({...ledger,entries:ledger.entries.map(row=>row.id===entry.id?restored:row)});
}
