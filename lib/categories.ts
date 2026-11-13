import {checkItemName,itemStatus} from './ledger-items';
import {CATEGORIES,type Ledger} from './ledger.ts';
export const categoryNames=(l:Ledger)=>[...new Set([...CATEGORIES,...(l.extraCategories||[]),...l.entries.flatMap(e=>[e.category,...Object.keys(e.effects.spendByCategory||{}),...(e.recoveries||[]).map(part=>part.category)]).filter(c=>c&&c!=='Multiple categories')])];
export const categoryType=(l:Ledger,c:string)=>l.categoryTypes?.[c]||(c==='Salary'?'income':'expense');
export function addCategory(l:Ledger,input:string,type:'income'|'expense'='expense'):Ledger{
 const existing=categoryNames(l).find(key=>key.toLowerCase()===input.trim().replace(/\s+/g,' ').toLowerCase());
 const reuse=existing&&itemStatus(l,'category',existing)==='deleted'?existing:undefined;
 const name=checkItemName(l,'category',input,reuse),key=reuse||name;
 return {...l,...reuse&&{categorySettings:{...l.categorySettings,[key]:{name}}},
  extraCategories:reuse?l.extraCategories:[...(l.extraCategories||[]),key],categoryTypes:{...l.categoryTypes,[key]:type}};
}
