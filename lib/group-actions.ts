import {emptyEffects,type Entry,type Ledger} from './ledger';
import {prepareEntry,normalize,resolvePerson} from './v2';
export type NewReceipt={assignmentId:string;amount:number;date:string;account:string};
export function recordGroup(l:Ledger,entry:Entry,received:NewReceipt[]=[],old?:Entry){
 let next=prepareEntry(l,entry,old);
 const payment=next.entries.find(e=>e.id===entry.id)!;
 if(old&&received.length)throw Error('Add receipts separately when editing an existing group payment.');
 for(const r of received){if(!r.amount)continue;const a=payment.group!.assignments.find(a=>a.id===r.assignmentId);if(!a)throw Error('Reimburser not found.');next=prepareEntry(next,{id:crypto.randomUUID(),kind:'groupReceipt',date:r.date,month:r.date.slice(0,7),description:`${a.person} reimbursed · ${entry.description}`,amount:r.amount,account:r.account,person:a.person,category:'',notes:'',effects:emptyEffects(),receipt:{groupId:entry.id,assignmentId:a.id}})}
 return normalize(next);
}
