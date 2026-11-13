import {parseAmount} from './money-input';
import type {Entry} from './ledger';

export function transactionSearch(query:string){
 const text=query.trim().toLowerCase();
 let amount:number|undefined;
 try{amount=parseAmount(text.replace(/^(?:pkr|rs\.?)\s*/,''))}catch{}
 const local=/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
 const date=local?local[3]+'-'+local[2].padStart(2,'0')+'-'+local[1].padStart(2,'0'):text;
 const period=/^\d{4}-\d{2}(?:-\d{2})?$/.test(date);
 return (entry:Entry,description:string)=>!text||entry.amount===amount
  ||(period&&(entry.date===date||entry.month===date||(date.length===7&&entry.date.startsWith(date+'-'))))
  ||description.toLowerCase().includes(text);
}
