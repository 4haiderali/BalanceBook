import {totals,type Ledger} from './ledger';
import {itemName} from './ledger-items';

export function entryWarnings(before:Ledger,after:Ledger,today:string){
 const warnings=new Set<string>();
 const previous=new Map(before.entries.map(entry=>[entry.id,entry]));
 const changed=after.entries.filter(entry=>{
  const old=previous.get(entry.id);
  return !old||old.deleted!==entry.deleted||old.date!==entry.date||old.month!==entry.month
   ||JSON.stringify(old.effects.accounts)!==JSON.stringify(entry.effects.accounts);
 });
 const dates=new Map<string,Set<string>>();
 for(const entry of changed){
  const old=previous.get(entry.id);
  if(!entry.deleted){
   if(old?.date!==entry.date&&Date.parse(entry.date)-Date.parse(today)>31*86400000)
    warnings.add('The actual date '+entry.date+' is more than 31 days ahead.');
   const monthNumber=(value:string)=>Number(value.slice(0,4))*12+Number(value.slice(5,7));
   if((old?.date!==entry.date||old.month!==entry.month)&&Math.abs(monthNumber(entry.month)-monthNumber(entry.date))>1)
    warnings.add('Report month '+entry.month+' is more than one month away from the actual date.');
  }
  for(const row of [old,entry]){
   if(!row||row.deleted)continue;
   for(const account of Object.keys(row.effects.accounts)){
    if(!dates.has(account))dates.set(account,new Set());
    dates.get(account)!.add(row.date);
   }
  }
 }
 for(const [account,days] of dates)for(const date of [...days,today,'9999-12-31']){
  const amount=totals(after,date).accounts[account]||0;
  if(amount<0&&amount<(totals(before,date).accounts[account]||0)){
   warnings.add(itemName(after,'account',account)+' would have a lower negative balance: PKR '+(amount/100).toLocaleString('en-PK')+'.');
   break;
  }
 }
 return [...warnings];
}
