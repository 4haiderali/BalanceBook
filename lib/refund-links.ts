import type {Ledger,Entry} from './ledger';
export type RefundLink={refundId:string;allocations:{expenseId:string;amount:number}[];reason:string};
export const refundLinks=(l:Ledger)=>l.refundLinks||[];
export function linkedRecovered(l:Ledger,id:string,exclude=''){let sum=0;for(const e of l.entries){if(e.deleted||e.id===exclude)continue;for(const x of e.recoveries||[])if(x.expenseId===id)sum+=x.amount;const link=refundLinks(l).find(x=>x.refundId===e.id);for(const x of link?.allocations||[])if(x.expenseId===id)sum+=x.amount}return sum}
export function refundCandidates(l:Ledger,refund:Entry){if(refund.date<'2026-08-01'||refund.effects.spend>=0)return [];return l.entries.filter(e=>!e.deleted&&e.date>='2026-08-01'&&e.date<=refund.date&&e.effects.spend>0&&!e.effects.spendByCategory&&e.category===refund.category&&e.effects.spend===-refund.effects.spend&&Date.parse(refund.date)-Date.parse(e.date)<=45*86400000).sort((a,b)=>b.date.localeCompare(a.date))}
export function pendingRefunds(l:Ledger,expenseId?:string){return l.entries.filter(e=>!e.deleted&&e.date>='2026-08-01'&&e.effects.spend<0&&!e.recoveries&&!refundLinks(l).some(x=>x.refundId===e.id)&&(!expenseId||refundCandidates(l,e).some(x=>x.id===expenseId)))}
export function validateRefundLinks(l:Ledger){const ids=new Set<string>();if(l.refundLinks&&!Array.isArray(l.refundLinks))throw Error('Invalid refund links.');for(const link of refundLinks(l)){
 const refund=l.entries.find(e=>e.id===link.refundId&&!e.deleted);if(!refund||refund.effects.spend>=0||refund.recoveries||ids.has(link.refundId)||!Array.isArray(link.allocations)||!link.reason?.trim())throw Error('Check the existing refund link and explanation.');ids.add(link.refundId);const expenses=new Set<string>();let sum=0;for(const part of link.allocations){const expense=l.entries.find(e=>e.id===part.expenseId&&!e.deleted);if(!expense||expense.date>refund.date||expense.effects.spend<=0||expense.effects.spendByCategory||expense.category!==refund.category||expenses.has(part.expenseId)||!Number.isSafeInteger(part.amount)||part.amount<=0)throw Error('Existing refund must link to an earlier personal expense in the same category.');expenses.add(part.expenseId);sum+=part.amount}if(link.allocations.length&&sum!==-refund.effects.spend)throw Error('Allocate the full existing refund, or leave it unlinked with an explanation.');
 }
 const recovered=new Map<string,number>();
 const links=new Map(refundLinks(l).map(link=>[link.refundId,link.allocations]));
 for(const entry of l.entries){
  if(entry.deleted)continue;
  for(const part of [...(entry.recoveries||[]),...(links.get(entry.id)||[])]){
   if(part.expenseId)recovered.set(part.expenseId,(recovered.get(part.expenseId)||0)+part.amount);
  }
 }
 for(const e of l.entries)if(!e.deleted&&e.effects.spend>0&&(recovered.get(e.id)||0)>e.effects.spend)throw Error('Already recovered more than the personal expense for '+e.description+'. Review its existing refund links.');
}
export function setRefundLink(l:Ledger,refundId:string,expenseId:string|null,reason:string):Ledger{const e=l.entries.find(e=>e.id===refundId);if(!e)throw Error('Refund not found.');const next={...l,refundLinks:[...refundLinks(l).filter(x=>x.refundId!==refundId),{refundId,allocations:expenseId?[{expenseId,amount:-e.effects.spend}]:[],reason}]};validateRefundLinks(next);return next}
export function removeRefundLink(l:Ledger,refundId:string,reason:string):Ledger{if(!reason.trim())throw Error('Explain why you are removing the link.');return {...l,refundLinks:refundLinks(l).filter(x=>x.refundId!==refundId)}}
