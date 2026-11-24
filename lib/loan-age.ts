import type {Ledger} from './ledger';

export type LoanAge={oldestUnpaidDate:string;lastRepaymentDate:string|null;daysOutstanding:number};

export function loanAge(ledger:Ledger,today:string):Map<string,LoanAge>{
 const accounts=new Map<string,{loans:{date:string;remaining:number}[];first:number;lastRepaymentDate:string|null}>();
 function account(person:string){
  const existing=accounts.get(person);
  if(existing)return existing;
  const next={loans:[],first:0,lastRepaymentDate:null};
  accounts.set(person,next);
  return accounts.get(person)!;
 }

 const events=ledger.entries.filter(entry=>!entry.deleted&&entry.date<=today
  &&entry.person&&(entry.kind==='lend'||entry.kind==='repaymentIn'))
  .map(entry=>({person:entry.person,date:entry.date,amount:entry.amount,repayment:entry.kind==='repaymentIn'}));
 if(ledger.baselineDate<=today){
  for(const [person,opening] of Object.entries(ledger.openingPeople)){
   if(opening.receivable>0)events.unshift({person,date:ledger.baselineDate,amount:opening.receivable,repayment:false});
  }
 }
 events.sort((a,b)=>a.date.localeCompare(b.date));
 for(const event of events){
  const state=account(event.person);
  if(!event.repayment){
   state.loans.push({date:event.date,remaining:event.amount});
   continue;
  }
  state.lastRepaymentDate=event.date;
  let remaining=event.amount;
  while(remaining>0&&state.first<state.loans.length){
   const oldest=state.loans[state.first];
   const paid=Math.min(remaining,oldest.remaining);
   remaining-=paid;
   oldest.remaining-=paid;
   if(oldest.remaining===0)state.first++;
  }
 }

 const result=new Map<string,LoanAge>();
 const currentDay=Date.parse(today+'T00:00:00Z');
 for(const [person,state] of accounts){
  const oldest=state.loans[state.first];
  if(oldest)result.set(person,{
   oldestUnpaidDate:oldest.date,
   lastRepaymentDate:state.lastRepaymentDate,
   daysOutstanding:(currentDay-Date.parse(oldest.date+'T00:00:00Z'))/86_400_000,
  });
 }
 return result;
}
