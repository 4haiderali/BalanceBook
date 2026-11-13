import type {Ledger} from './ledger';

export function nextFoodShareRange(ledger:Ledger,today:string){
 const last=ledger.entries.reduce((latest,entry)=>{
  const end=entry.foodRange?.to;
  return !entry.deleted&&entry.kind==='weeklyShare'&&end&&end<=today&&end>latest?end:latest;
 },'');
 const next=last?new Date(Date.parse(last+'T00:00:00Z')+86400000).toISOString().slice(0,10):'';
 return {from:next<=today?next:'',to:today};
}
