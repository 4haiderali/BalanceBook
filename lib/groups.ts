import type {Entry,Ledger} from './ledger';
export type Assignment={id:string;person:string;amount:number};
export type GroupPayment={loanUsed:number;selfFunded:number;assignments:Assignment[]};
export type GroupReceipt={groupId:string;assignmentId:string};
export function groupAssignments(l:Ledger,asOf='9999-12-31'){
 return l.entries.filter(e=>!e.deleted&&e.kind==='groupPayment'&&e.group&&e.date<=asOf).flatMap(e=>e.group!.assignments.map(a=>{
 const received=l.entries.filter(r=>!r.deleted&&r.kind==='groupReceipt'&&r.date<=asOf&&r.receipt?.groupId===e.id&&r.receipt?.assignmentId===a.id).reduce((s,r)=>s+r.amount,0);
 return {groupId:e.id,description:e.description,payee:e.person,date:e.date,assignmentId:a.id,person:a.person,assigned:a.amount,received,remaining:a.amount-received};
 }));
}
export function groupReceipts(l:Ledger,id:string){return l.entries.filter(e=>!e.deleted&&e.kind==='groupReceipt'&&e.receipt?.groupId===id)}
