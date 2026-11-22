import type {Entry,Ledger} from './ledger';
const legacyTransfers=new Set(['Saving','Savings Withdrawal','Cash Withdrawal','Cash Deposit','Internal Transfer']);
export const isTransfer=(entry:Entry)=>entry.kind==='transfer'||entry.kind==='legacy'&&legacyTransfers.has(entry.legacyType||'');
export const TRANSFER_CATEGORY_REPAIR='Removed categories incorrectly attached to transfers or balance adjustments; amounts and balances unchanged';
export function repairTransferCategories(ledger:Ledger){
 let count=0;
 const entries=ledger.entries.map(entry=>{
  if(!entry.category||(!isTransfer(entry)&&entry.kind!=='adjustment'))return entry;
  // Preserve imported originals and every financial effect, including tombstones.
  count++;
  return {...entry,category:'',...(entry.kind==='legacy'&&!entry.original?{original:structuredClone(entry)}:{})};
 });
 return {data:count?{...ledger,entries}:ledger,count};
}
