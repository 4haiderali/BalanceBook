import {categoryNames} from './categories.ts';
import {accountNames} from './accounts.ts';
import {linkedRecovered} from './refund-links.ts';
import {groupAssignments} from './groups.ts';
export const ACCOUNTS = ['Alfalah','NayaPay','BOP Savings','NBP','Cash','Legacy Current'];
export const CATEGORIES = ['Food','Grocery','Rent','Transport','Fuel','Shopping','Health','Personal','Misc','Charity','Gifts','Bills','Salary'];
export const KINDS: Record<string,string> = {officeRecovery:'Office reimbursed me',merchantRefund:'Linked merchant refund',expense:'Expense',refund:'Refund',income:'Income',transfer:'Transfer',lend:'Lend money',borrow:'Borrow money',repaymentIn:'Receive repayment',repaymentOut:'Repay borrowing',shared:'Shared purchase',personExpense:'Someone paid my share',lunchAdvance:'Pay the group organizer / lunch advance',lunchRecovery:'Lunch reimbursement',splitwiseShare:'My lunch / roti share',splitwiseFunding:'My turn to fund lunch',weeklyShare:'My Splitwise food share (no bank movement)',groupPayment:'I paid for the group',groupReceipt:'Group reimbursement received',adjustment:'Balance adjustment'};
export type Effects = {accounts:Record<string,number>;spend:number;income:number;receivable:Record<string,number>;payable:Record<string,number>;clearing:number;splitwise:number;spendByCategory?:Record<string,number>;groupDue?:Record<string,number>};
export type Entry = {parking?:import('./parking').Parking;payee?:string;templateId?:string;id:string;date:string;month:string;description:string;kind:string;category:string;amount:number;account:string;to?:string;person:string;notes:string;legacyType?:string;sourceRow?:number;effects:Effects;splits?:{person:string;amount:number}[];ownShare?:number;deleted?:boolean;original?:Entry;group?:import('./groups').GroupPayment;receipt?:import('./groups').GroupReceipt;recoveries?:{expenseId?:string;category:string;amount:number}[];foodRange?:{from:string;to:string};checkpointId?:string};
export type Ledger = {accountSettings?:import('./ledger-items').ItemSettings;categorySettings?:import('./ledger-items').ItemSettings;tailoringVersion?:number;sourceOpenings?:Record<string,number>;accountTypes?:Record<string,'current'|'savings'|'wallet'|'cash'>;extraCategories?:string[];categoryTypes?:Record<string,'income'|'expense'>;shortcuts?:import('./shortcuts').Shortcut[];extraAccounts?:string[];confirmedBankAllocation?:{date:string;nayapay:number};version:number;baselineDate:string;openings:Record<string,number>;openingPeople:Record<string,{receivable:number;payable:number}>;entries:Entry[];reference:{month:string;income:number;spend:number;current:number|null;cash:number|null;savings:number|null}[];sourceName:string;includeSplitwise:boolean;splitwiseOpening:number;splitwiseOpeningDate:string;accountStatus:string;refundLinks?:import('./refund-links').RefundLink[];review?:import('./review').ReviewData;people?:import('./v2').Person[];audit?:import('./v2').Audit[]};
export const emptyEffects=():Effects=>({accounts:{},spend:0,income:0,receivable:{},payable:{},clearing:0,splitwise:0});
const add=(obj:Record<string,number>,key:string,n:number)=>{obj[key]=(obj[key]||0)+n};
export function totals(l:Ledger,asOf='9999-12-31',onlyLegacy=false){
 const groupPeople:Record<string,number>={};const accounts={...l.openings};const people=JSON.parse(JSON.stringify(l.openingPeople)) as Ledger['openingPeople']; let clearing=0,splitwise=asOf>=l.splitwiseOpeningDate?l.splitwiseOpening:0;
 for(const e of l.entries){if(e.deleted||e.date>asOf||(onlyLegacy&&e.kind!=='legacy'))continue;const f=e.effects;
 if(e.date>=l.baselineDate)for(const [a,n] of Object.entries(f.accounts))add(accounts,a,n);
 for(const [p,n] of Object.entries(f.receivable)){people[p]??={receivable:0,payable:0};people[p].receivable+=n}
 for(const [p,n] of Object.entries(f.payable)){people[p]??={receivable:0,payable:0};people[p].payable+=n}
 for(const [p,n] of Object.entries(f.groupDue||{}))add(groupPeople,p,n);
 clearing+=f.clearing;if(e.date>=l.splitwiseOpeningDate)splitwise+=f.splitwise;
 }
 const receivable=Object.values(people).reduce((a,p)=>a+p.receivable,0),payable=Object.values(people).reduce((a,p)=>a+p.payable,0);
 const groupReceivable=Object.values(groupPeople).reduce((a,n)=>a+n,0);const cash=Object.values(accounts).reduce((a,n)=>a+n,0);return {accounts,people,receivable,payable,clearing,splitwise,groupPeople,groupReceivable,netWorth:cash+receivable-payable+clearing+groupReceivable-(l.includeSplitwise?splitwise:0)};
}
export function report(l:Ledger,period:string,onlyLegacy=false){let income=0,spend=0,refunds=0;const categories:Record<string,number>={};for(const e of l.entries){if(e.deleted||!e.month.startsWith(period)||(onlyLegacy&&e.kind!=='legacy'))continue;income+=e.effects.income;spend+=e.effects.spend;if(e.effects.spend<0)refunds-=e.effects.spend;if(e.effects.spendByCategory){for(const [c,n] of Object.entries(e.effects.spendByCategory))add(categories,c,n)}else if(e.effects.spend)add(categories,e.category||'Uncategorized',e.effects.spend)}return{income,spend,surplus:income-spend,refunds,categories}}
type ReplayState={
 accounts:Set<string>;categories:Set<string>;
 people:Ledger['openingPeople'];clearing:number;
 purchases:Map<string,Entry>;recovered:Map<string,number>;
 groups:Map<string,Map<string,{person:string;remaining:number}>>;
};
class RepaymentShortfall extends Error{
 constructor(readonly shortfall:number){
  super('This repayment exceeds the outstanding balance on its actual date.');
 }
}
function repaymentShortfall(amount:number,balance:number){
 return new RepaymentShortfall(amount-balance);
}
export class ReplayError extends Error{
 readonly shortfall:number|undefined;
 constructor(readonly entry:Entry,cause:unknown){
  super(`${entry.date} · ${entry.description}: ${cause instanceof Error?cause.message:'Invalid transaction.'}`);
  this.shortfall=cause instanceof RepaymentShortfall?cause.shortfall:undefined;
 }
}
export function makeEntry(raw:Omit<Entry,'effects'>,l:Ledger,state?:ReplayState):Entry{
 const e={...raw,effects:emptyEffects()};const f=e.effects,a=e.amount,p=e.person;const acct=(n:number)=>add(f.accounts,e.account,n);
 if(!Number.isSafeInteger(a)||a<=0)throw Error('Enter an amount greater than zero with at most two decimal places.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date))||new Date(e.date+'T00:00:00Z').toISOString().slice(0,10)!==e.date||e.date<l.baselineDate)throw Error('Use a valid actual date on or after the balance baseline.');
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.month))throw Error('Choose a report month.');
 if(!e.description.trim())throw Error('Add a description.');
 if(!(e.kind in KINDS))throw Error('Choose a transaction type.');
 if(['expense','refund','income','shared','personExpense','splitwiseShare','weeklyShare'].includes(e.kind)&&!e.category)throw Error('Choose a category.');
 if(['lend','borrow','repaymentIn','repaymentOut','personExpense','groupPayment','groupReceipt'].includes(e.kind)&&!p.trim())throw Error('Choose or enter a person.');
 if(!['personExpense','splitwiseShare','splitwiseFunding','weeklyShare','groupPayment'].includes(e.kind)&&!(state?state.accounts.has(e.account):accountNames(l).includes(e.account)))throw Error('Choose an account.');
 const position=(state?.people||totals(l,e.date).people)[p]||{receivable:0,payable:0};
 switch(e.kind){
 case 'officeRecovery':case 'merchantRefund':{
 const parts=e.recoveries;if(!Array.isArray(parts)||!parts.length||parts.reduce((s,x)=>s+x.amount,0)!==a)throw Error('Recovery allocations must equal the amount received.');
 if(e.kind==='merchantRefund'&&(parts.length!==1||!parts[0].expenseId))throw Error('A merchant refund must link to one purchase.');
 const seen=new Set<string>();f.spendByCategory={};
 for(const x of parts){
 if(!Number.isSafeInteger(x.amount)||x.amount<=0||!(state?state.categories.has(x.category):categoryNames(l).includes(x.category)))throw Error('Check each recovered amount and category.');
 if(x.expenseId){
 if(seen.has(x.expenseId))throw Error('Allocate each purchase once.');seen.add(x.expenseId);
 const original=state?state.purchases.get(x.expenseId):l.entries.find(q=>q.id===x.expenseId&&!q.deleted);
 if(!original||original.date>e.date||original.effects.spend<=0||original.effects.spendByCategory||original.category!==x.category)throw Error('Linked purchase must exist on or before the receipt date, with the same expense category.');
 const used=state?(state.recovered.get(x.expenseId)||0):linkedRecovered(l,x.expenseId);
 if(x.amount>original.effects.spend-used)throw Error('Refund or reimbursement exceeds your remaining personal expense for '+original.description+'.');
 }else if(!e.notes.trim())throw Error('Explain an unlinked office reimbursement in Notes.');
 add(f.spendByCategory,x.category,-x.amount);
 }acct(a);f.spend=-a;break;
 }
 case 'expense':acct(-a);f.spend=a;break;
 case 'refund':acct(a);f.spend=-a;break;
 case 'income':acct(a);f.income=a;break;
 case 'transfer':if(e.to===e.account||!(state?state.accounts.has(e.to||''):accountNames(l).includes(e.to||'')))throw Error('Choose a different destination account.');acct(-a);add(f.accounts,e.to!,a);break;
 case 'lend':acct(-a);f.receivable[p]=a;break;
 case 'borrow':acct(a);f.payable[p]=a;break;
 case 'repaymentIn':if(a>position.receivable)throw repaymentShortfall(a,position.receivable);acct(a);f.receivable[p]=-a;break;
 case 'repaymentOut':if(a>position.payable)throw repaymentShortfall(a,position.payable);acct(-a);f.payable[p]=-a;break;
 case 'personExpense':{const offset=Math.min(a,Math.max(0,position.receivable));f.spend=a;if(offset)f.receivable[p]=-offset;if(a>offset)f.payable[p]=a-offset;break;}
 case 'shared':{if(!Number.isSafeInteger(e.ownShare)||e.ownShare!<0)throw Error('Enter your own share.');const splits=e.splits||[];if(!splits.length||splits.some(x=>!x.person.trim()||!Number.isSafeInteger(x.amount)||x.amount<=0))throw Error('Enter a person and positive amount for every split.');if(e.ownShare!+splits.reduce((s,x)=>s+x.amount,0)!==a)throw Error('Your share plus other people’s shares must equal the total paid.');acct(-a);f.spend=e.ownShare!;for(const x of splits)add(f.receivable,x.person,x.amount);break;}
 case 'lunchAdvance':acct(-a);f.clearing=a;break;
 case 'lunchRecovery':if(a>(state?.clearing??totals(l,e.date).clearing))throw Error('Reimbursement exceeds outstanding lunch advances.');acct(a);f.clearing=-a;break;
 case 'splitwiseShare':f.spend=a;f.splitwise=a;break;
 case 'splitwiseFunding':if(a>(state?.clearing??totals(l,e.date).clearing))throw Error('Contribution exceeds outstanding lunch advances.');f.clearing=-a;f.splitwise=-a;break;
 case 'weeklyShare':if(e.foodRange&&(!/^\d{4}-\d{2}-\d{2}$/.test(e.foodRange.from)||!/^\d{4}-\d{2}-\d{2}$/.test(e.foodRange.to)||![e.foodRange.from,e.foodRange.to].every(d=>Number.isFinite(Date.parse(d))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d)||e.foodRange.from>e.foodRange.to))throw Error('Choose a valid Food coverage date range.');if(e.category!=='Food')throw Error('Your Splitwise consumption belongs to Food.');f.spend=a;break;
 case 'groupPayment':{
  const g=e.group;if(!g||!Number.isSafeInteger(g.loanUsed)||g.loanUsed<0||g.loanUsed>a||!Number.isSafeInteger(g.selfFunded)||g.selfFunded<0||!Array.isArray(g.assignments))throw Error('Check the group payment funding.');
  if(g.loanUsed>Math.max(0,position.receivable))throw Error('The loan offset exceeds what this person owes you on the payment date.');
  const ids=new Set<string>(),persons=new Set<string>();for(const x of g.assignments){if(!x.id||ids.has(x.id)||!x.person.trim()||persons.has(x.person)||!Number.isSafeInteger(x.amount)||x.amount<=0)throw Error('Enter each reimburser once, with a positive amount.');ids.add(x.id);persons.add(x.person)}
  if(g.selfFunded+g.assignments.reduce((s,x)=>s+x.amount,0)!==a)throw Error('Reimbursements plus your no-reimbursement contribution must equal the bill.');
  const now=a-g.loanUsed;if(now){if(!(state?state.accounts.has(e.account):accountNames(l).includes(e.account)))throw Error('Choose the account used for the fresh payment.');acct(-now)}
  if(g.loanUsed)f.receivable[p]=-g.loanUsed;
  f.groupDue={};for(const x of g.assignments)add(f.groupDue,x.person,x.amount);break;
 }
 case 'groupReceipt':{
  if(!e.receipt)throw Error('Choose an assigned group payment.');
  const due=state?state.groups.get(e.receipt.groupId)?.get(e.receipt.assignmentId):groupAssignments(l,e.date).find(x=>x.groupId===e.receipt!.groupId&&x.assignmentId===e.receipt!.assignmentId);
  if(!due||due.person!==p)throw Error('The assigned group payment is missing or occurs after this receipt.');
  if(a>due.remaining)throw Error('Receipt exceeds the amount still due on this group assignment.');
  acct(a);f.groupDue={[p]:-a};break;
 }
 case 'adjustment':if(!e.notes.trim())throw Error('Explain the balance adjustment in Notes.');acct(e.to==='subtract'?-a:a);break;
 }
 return e;
}
export function validateLedger(l:Ledger){
 if(!l||l.version!==1||!Array.isArray(l.entries)||l.entries.length>30000||!l.openings||!l.openingPeople||!Array.isArray(l.reference)||!/^\d{4}-\d{2}-\d{2}$/.test(l.baselineDate)||!Number.isSafeInteger(l.splitwiseOpening))throw Error('Invalid backup format.');
 if(l.extraAccounts&&(!Array.isArray(l.extraAccounts)||l.extraAccounts.some(n=>typeof n!=='string'||!n.trim()||n.length>60||['__proto__','constructor','prototype','Current','Savings','Non-cash','Splitwise'].includes(n))||new Set(accountNames(l).map(n=>n.toLowerCase())).size!==accountNames(l).length))throw Error('Invalid account names.');
 if(l.extraCategories&&(!Array.isArray(l.extraCategories)||l.extraCategories.some(c=>typeof c!=='string'||!c.trim()||c.length>60||['__proto__','constructor','prototype'].includes(c))))throw Error('Invalid categories.');
 if(l.accountTypes&&Object.values(l.accountTypes).some(t=>!['current','savings','wallet','cash'].includes(t)))throw Error('Invalid account type.');
 if(l.shortcuts&&(!Array.isArray(l.shortcuts)||new Set(l.shortcuts.map(s=>s.id)).size!==l.shortcuts.length||l.shortcuts.some(s=>!s.id||!s.name.trim()||!Number.isSafeInteger(s.amount)||s.amount<0||!['expense','income','transfer'].includes(s.kind)||!accountNames(l).includes(s.account)||!/^\d{4}-\d{2}-\d{2}$/.test(s.nextDue)||!Number.isFinite(Date.parse(s.nextDue)))))throw Error('Invalid shortcut.');
 const checkMap=(m:any)=>{if(!m||typeof m!=='object'||Object.values(m).some(n=>!Number.isSafeInteger(n)))throw Error('Invalid monetary values in backup.');};checkMap(l.openings);
 for(const p of Object.values(l.openingPeople))checkMap(p);
 const ids=new Set();for(const e of l.entries){if(!e.id||ids.has(e.id))throw Error('Duplicate transaction IDs.');ids.add(e.id);if(typeof e.description!=='string'||typeof e.month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.month)||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!e.effects||!Number.isSafeInteger(e.amount)||e.amount<=0)throw Error('Invalid transaction in backup.');for(const k of ['accounts','receivable','payable'] as const)checkMap(e.effects[k]);if(e.effects.groupDue)checkMap(e.effects.groupDue);if(e.effects.spendByCategory)checkMap(e.effects.spendByCategory);for(const k of ['spend','income','clearing','splitwise'] as const)if(!Number.isSafeInteger(e.effects[k]))throw Error('Invalid transaction effects.');}
 return l;
}
export function reconciliation(input:Ledger){const l={...input,tailoringVersion:undefined,openings:input.sourceOpenings||input.openings,entries:input.entries.map(e=>e.original||e)};return l.reference.filter(r=>r.income!==0||r.spend!==0||r.current!==null||r.cash!==null||r.savings!==null).map(r=>{const s=report(l,r.month,true);const last=new Date(Number(r.month.slice(0,4)),Number(r.month.slice(5)),0).getDate();const b=totals(l,r.month+'-'+last,true);const diffs=[s.income-r.income,s.spend-r.spend];if(r.current!==null)diffs.push((b.accounts['Legacy Current']||0)-r.current);if(r.cash!==null)diffs.push((b.accounts.Cash||0)-r.cash);if(r.savings!==null)diffs.push((b.accounts['BOP Savings']||0)-r.savings);return {...r,actualIncome:s.income,actualSpend:s.spend,difference:Math.max(...diffs.map(Math.abs)),diffs}})}
// Recalculate app entries in actual-date order after edits/deletions, so offsets
// and repayment limits cannot silently become stale when an earlier entry changes.
export function reflow(l:Ledger):Ledger{
 const legacy=l.entries.filter(e=>e.kind==='legacy'&&!e.deleted);
 const byDate=(a:Entry,b:Entry)=>a.date.localeCompare(b.date);
 const datedLegacy=legacy.slice().sort(byDate);
 const ordered=l.entries.filter(e=>e.kind!=='legacy'&&!e.deleted).sort(byDate);
 const state:ReplayState={
  accounts:new Set(accountNames(l)),categories:new Set(categoryNames({...l,entries:l.entries.filter(e=>e.kind==='legacy')})),people:structuredClone(l.openingPeople),clearing:0,purchases:new Map(),
  recovered:new Map(),groups:new Map(),
 };
 const effects=new Map<string,Effects>();
 const links=new Map((l.refundLinks||[]).slice().reverse().map(link=>[link.refundId,link.allocations]));
 function indexRecoveries(e:Entry){
  for(const part of [...(e.recoveries||[]),...(links.get(e.id)||[])]){
   if(part.expenseId)state.recovered.set(part.expenseId,(state.recovered.get(part.expenseId)||0)+part.amount);
  }
 }
 function applyPosition(e:Entry){
  for(const field of ['receivable','payable'] as const)for(const [key,value] of Object.entries(e.effects[field])){
   state.people[key]??={receivable:0,payable:0};
   state.people[key][field]+=value;
  }
  state.clearing+=e.effects.clearing;
 }
 // Legacy records are available to link lookup immediately, but balances
 // include them only through the transaction's actual date.
 for(const entry of legacy){state.purchases.set(entry.id,entry);indexRecoveries(entry);}
 let cursor=0;
 for(const entry of ordered){
  while(cursor<datedLegacy.length&&datedLegacy[cursor].date<=entry.date)applyPosition(datedLegacy[cursor++]);
  try{
   const calculated=makeEntry(entry,l,state);
   effects.set(entry.id,calculated.effects);
   applyPosition(calculated);
   state.purchases.set(entry.id,calculated);
   indexRecoveries(calculated);
   if(calculated.category&&calculated.category!=='Multiple categories')state.categories.add(calculated.category);
   for(const key of Object.keys(calculated.effects.spendByCategory||{}))if(key!=='Multiple categories')state.categories.add(key);
   if(calculated.kind==='groupPayment'&&calculated.group){
    state.groups.set(entry.id,new Map(calculated.group.assignments.map(a=>[a.id,{person:a.person,remaining:a.amount}])));
   }
   if(calculated.kind==='groupReceipt'&&calculated.receipt){
    state.groups.get(calculated.receipt.groupId)!.get(calculated.receipt.assignmentId)!.remaining-=calculated.amount;
   }
  }catch(error){throw new ReplayError(entry,error);}
 }
 return {...l,entries:l.entries.map(e=>effects.has(e.id)?{...e,effects:effects.get(e.id)!}:e)};
}
