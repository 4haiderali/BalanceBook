import type {Checkpoint} from './review';

export const positiveShare=(amount:number,total:number)=>amount>0&&total>0?amount/total:0;

export function lastConfirmedDates(checkpoints:readonly Pick<Checkpoint,'account'|'date'>[]):Map<string,string>{
 const dates=new Map<string,string>();
 for(const {account,date} of checkpoints){
  const previous=dates.get(account);
  if(!previous||date>previous)dates.set(account,date);
 }
 return dates;
}

export type CategorySort='spending'|'name'|'original';

export function sortCategoryCards<T extends {name:string;spend:number}>(cards:T[],order:CategorySort):T[]{
 if(order==='original')return cards;
 return [...cards].sort((a,b)=>order==='name'?a.name.localeCompare(b.name)
  :Number(a.spend===0)-Number(b.spend===0)||b.spend-a.spend);
}
