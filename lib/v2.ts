import {checkActiveEntryItems,validateLedgerItems} from './ledger-items';
import {validateParking,validateParkingTransition,parkingSummary} from './parking';
import {completeShortcut} from './shortcuts';
import {accountNames} from './accounts';
import {validateRefundLinks} from './refund-links';
import {validateReview,withHistoricalReview} from './review';
import {ACCOUNTS,ReplayError,emptyEffects,makeEntry,reflow,totals,report,validateLedger,type Entry,type Ledger} from './ledger';
export type Person={id:string;key:string;name:string;aliases:string[];archived:boolean;manual?:boolean;notPerson?:boolean;mergedInto?:string};
export type Audit={id:string;at:string;action:string;target:string;reason:string;before:any;after:any};
export const LEGACY_TYPES=['Income','Expense','Refund','Saving','Savings Withdrawal','Cash Withdrawal','Cash Deposit','Lent','Loan Returned','Borrowed','Borrowing Repaid','Adjustment Add','Adjustment Subtract','Settlement In','Settlement Out','Internal Transfer','Ignore'];
const clean=(s:string)=>s.trim().replace(/\s+/g,' ');
const identity=(s:string)=>clean(s).toLocaleLowerCase();
export function normalize(l:Ledger):Ledger{
 const copy={...l,people:(l.people||[]).map(p=>({...p,aliases:[...p.aliases]})),audit:l.audit||[]};
 const known=new Set(copy.people.map(p=>p.key));
 const debtKeys=new Set<string>();
 const keys=new Set(Object.keys(l.openingPeople));for(const e of l.entries){if(e.person)keys.add(e.person);for(const k of Object.keys(e.effects.receivable))keys.add(k);for(const k of Object.keys(e.effects.payable))keys.add(k);for(const s of e.splits||[])keys.add(s.person);for(const a of e.group?.assignments||[])keys.add(a.person)}
 for(const key of keys)if(key&&!known.has(key))copy.people.push({id:'person:'+encodeURIComponent(key),key,name:key,aliases:[],archived:false});
 for(const entry of l.entries){
  for(const field of [entry.effects.receivable,entry.effects.payable])
   if(Object.values(field).some(Boolean))for(const key of Object.keys(field))debtKeys.add(key);
  for(const split of entry.splits||[])debtKeys.add(split.person);
  for(const assignment of entry.group?.assignments||[])debtKeys.add(assignment.person);
 }
 for(const p of copy.people)if(debtKeys.has(p.key))p.notPerson=false;
 return withHistoricalReview(copy);
}
export function personName(l:Ledger,key:string){return l.people?.find(p=>p.key===key)?.name||key}
export function resolvePerson(l:Ledger,input:string){const name=clean(input);const direct=l.people?.find(p=>p.key===input);if(direct)return direct.mergedInto||input;const found=l.people?.find(p=>[p.key,p.name,...p.aliases].some(n=>identity(n)===identity(name)));return found?.mergedInto||found?.key||name}
export function hasPersonHistory(l:Ledger,key:string){return l.entries.some(e=>e.person===key||key in e.effects.receivable||key in e.effects.payable||e.splits?.some(s=>s.person===key)||e.group?.assignments.some(a=>a.person===key)||e.original&&(e.original.person===key||key in e.original.effects.receivable||key in e.original.effects.payable))||!!l.openingPeople[key]?.receivable||!!l.openingPeople[key]?.payable}
export function managePerson(input:Ledger,key:string,action:'add'|'rename'|'archive'|'unarchive'|'delete',newName=''):Ledger{
 const l=normalize(input),p=l.people!.find(p=>p.key===key),name=clean(newName);
 if(action==='add'||action==='rename'){
 if(!name||name.length>100)throw Error('Enter a name between 1 and 100 characters.');
 if(l.people!.some(x=>x.key!==(action==='rename'?key:null)&&[x.key,x.name,...x.aliases].some(n=>identity(n)===identity(name))))throw Error('That name or alias already belongs to a person.');
 }
 if(action==='add'){l.people!.push({id:'person:'+encodeURIComponent(name),key:name,name,aliases:[],archived:false,manual:true});return l}
 if(!p)throw Error('Person not found.');
 const b=totals(l).people[key]||{receivable:0,payable:0};
 if((action==='archive'||action==='delete')&&(b.receivable!==0||b.payable!==0||(totals(l).groupPeople[key]||0)!==0))throw Error('Settle both the receivable and payable before removing this person.');
 if(action==='delete'){if(hasPersonHistory(l,key))throw Error('This person has transaction history. Archive them instead.');l.people=l.people!.filter(x=>x.key!==key);const o={...l.openingPeople};delete o[key];l.openingPeople=o}
 if(action==='rename'){if(p.name!==name&&!p.aliases.includes(p.name))p.aliases.push(p.name);p.name=name}
 if(action==='archive')p.archived=true;if(action==='unarchive')p.archived=false;
 return l;
}
export function correctLegacy(raw:Entry,old:Entry,baselineDate:string,allowedAccounts=ACCOUNTS,currentAccount='Legacy Current'):Entry{
 const e={...raw,kind:'legacy',sourceRow:old.sourceRow,original:old.original||{...old}};
 if(!Number.isSafeInteger(e.amount)||e.amount<=0)throw Error('Enter a positive amount in PKR.');
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.month)||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date))||new Date(e.date+'T00:00:00Z').toISOString().slice(0,10)!==e.date)throw Error('Choose valid dates.');
 if(!e.description.trim()||!LEGACY_TYPES.includes(e.legacyType||''))throw Error('Enter a description and valid Excel transaction type.');
 if(['Income','Expense','Refund'].includes(e.legacyType!)&&!e.category)throw Error('Choose a category.');
 if(['Lent','Loan Returned','Borrowed','Borrowing Repaid'].includes(e.legacyType!)&&!e.person)throw Error('Choose a person.');
 // Metadata-only edits keep exact original workbook effects, including historical regimes.
 if(e.amount===old.amount&&e.account===old.account&&e.person===old.person&&e.legacyType===old.legacyType&&(e.date<baselineDate)===(old.date<baselineDate)){e.effects=structuredClone(old.effects);return e}
 delete e.to;
 const a=e.amount,t=e.legacyType,f=emptyEffects(),account=e.account==='Current'?currentAccount:e.account==='Savings'?'BOP Savings':e.account;
 const bank=(n:number)=>{if(allowedAccounts.includes(account))f.accounts[account]=(f.accounts[account]||0)+n;else if(!['Non-cash','Splitwise'].includes(account))throw Error('Choose a valid account.');};
 if(t==='Saving'||t==='Savings Withdrawal'){if(!allowedAccounts.includes(account)||account==='BOP Savings')throw Error('For a savings transfer, select its other account.');const direction=t==='Saving'?-1:1;bank(a*direction);f.accounts['BOP Savings']=-a*direction}
 else if(t==='Cash Withdrawal'||t==='Cash Deposit'){const sign=t==='Cash Withdrawal'?1:-1;f.accounts={[currentAccount]:-a*sign,Cash:a*sign}}
 else if(['Income','Refund','Loan Returned','Borrowed','Adjustment Add','Settlement In'].includes(t!))bank(a);
 else if(['Expense','Lent','Borrowing Repaid','Adjustment Subtract','Settlement Out'].includes(t!))bank(-a);
 if(t==='Expense')f.spend=a;if(t==='Refund')f.spend=-a;if(t==='Income')f.income=a;
 if(t==='Lent')f.receivable[e.person]=a;if(t==='Loan Returned')f.receivable[e.person]=-a;if(t==='Borrowed')f.payable[e.person]=a;if(t==='Borrowing Repaid')f.payable[e.person]=-a;
 e.effects=f;return e;
}
function replayEditedLedger(next:Ledger,old?:Entry,replacement?:Entry){
 try{return reflow(next)}catch(error){
  if(!(error instanceof ReplayError)||!old||error.entry.id===old.id)throw error;
  const blocker=`“${error.entry.description}” on ${error.entry.date}`;
  const action=replacement?'edit':'delete';
  if(error.shortfall!==undefined){
   const sameLoan=replacement&&['lend','borrow'].includes(old.kind)&&replacement.kind===old.kind
    &&replacement.person===old.person&&replacement.date===old.date
    &&error.entry.person===old.person
    &&error.entry.kind===(old.kind==='lend'?'repaymentIn':'repaymentOut');
   const minimum=sameLoan?replacement.amount+error.shortfall:undefined;
   const detail=minimum!==undefined?`Keep the amount at least PKR ${(minimum/100).toLocaleString('en-PK',{maximumFractionDigits:2})} to cover that repayment, or correct the repayment first.`:'Correct the repayment first, or keep enough outstanding balance on its date.';
   throw Error(`Can’t ${action} “${old.description}” because repayment ${blocker} would exceed the outstanding balance. ${detail}`);
  }
  throw Error(`Can’t ${action} “${old.description}”. Check ${blocker} first. ${error.message.slice(error.message.indexOf(': ')+2)}`);
 }
}
export function prepareEntry(l:Ledger,raw:Entry,old?:Entry):Ledger{
 const n=normalize(l);raw={...raw,person:resolvePerson(n,raw.person),splits:raw.splits?.map(s=>({...s,person:resolvePerson(n,s.person)})),group:raw.group?{...raw.group,assignments:raw.group.assignments.map(a=>({...a,person:resolvePerson(n,a.person)}))}:undefined};
 const oldKeys=new Set([old?.person,...(old?.splits||[]).map(s=>s.person),...(old?.group?.assignments||[]).map(a=>a.person)]);const keys=[raw.person,...(raw.splits||[]).map(s=>s.person),...(raw.group?.assignments||[]).map(a=>a.person)];for(const key of keys){const p=n.people!.find(p=>p.key===key);if(p?.archived&&!oldKeys.has(key))throw Error(`${p.name} is archived. Restore them in People before using them.`)}
 let e:Entry;
 if(old?.kind==='legacy')e=correctLegacy(raw,old,n.baselineDate,accountNames(n),n.tailoringVersion?'Alfalah':'Legacy Current');
 else {e={...raw,effects:emptyEffects()};delete e.legacyType;if(!['transfer','adjustment'].includes(e.kind))delete e.to;if(['weeklyShare','personExpense','splitwiseShare','splitwiseFunding'].includes(e.kind))e.account='';}
 const replaced={...n,entries:old?n.entries.map(x=>x.id===old.id?e:x):[...n.entries,e]};
 const result=normalize(replayEditedLedger(!old&&raw.templateId?completeShortcut(replaced,raw.templateId,raw.id):replaced,old,e));validateRefundLinks(result);validateParkingTransition(l,result);return result;
}
export type Change={label:string;before:number;after:number};
export function previewChanges(before:Ledger,after:Ledger):Change[]{
 const result:Change[]=[],push=(label:string,a:number,b:number)=>{if(a!==b)result.push({label,before:a,after:b})};const a=totals(before),b=totals(after);
 for(const key of new Set([...Object.keys(a.accounts),...Object.keys(b.accounts)]))push(key,a.accounts[key]||0,b.accounts[key]||0);
 for(const key of new Set([...Object.keys(a.people),...Object.keys(b.people)])){push(`${personName(after,key)} · owes you`,a.people[key]?.receivable||0,b.people[key]?.receivable||0);push(`${personName(after,key)} · you owe`,a.people[key]?.payable||0,b.people[key]?.payable||0)}
 for(const key of new Set([...Object.keys(a.groupPeople),...Object.keys(b.groupPeople)]))push(`${personName(after,key)} · group reimbursement due`,a.groupPeople[key]||0,b.groupPeople[key]||0);
 push('Earlier unassigned advances',a.clearing,b.clearing);push('Splitwise test movement (not group balance)',a.splitwise-before.splitwiseOpening,b.splitwise-after.splitwiseOpening);
 const months=new Set([...before.entries,...after.entries].map(e=>e.month));for(const m of [...months].sort()){const x=report(before,m),y=report(after,m);push(`${m} · income`,x.income,y.income);for(const c of new Set([...Object.keys(x.categories),...Object.keys(y.categories)]))push(`${m} · ${c} spending`,x.categories[c]||0,y.categories[c]||0)}
 const parkingMonths=new Set([...before.entries,...after.entries].flatMap(e=>(e.parking?.allocations||[]).map(a=>a.month)));for(const month of parkingMonths)push(month+' · surplus parked',parkingSummary(before,month).parked,parkingSummary(after,month).parked);
 const previousEntries=new Map(before.entries.map(e=>[e.id,e]));
 const changed=after.entries.filter(e=>JSON.stringify(e)!==JSON.stringify(previousEntries.get(e.id)));
 const dates=new Set<string>();for(const e of changed){dates.add(e.date);const old=previousEntries.get(e.id);if(old)dates.add(old.date)}
 for(const date of dates){const x=totals(before,date),y=totals(after,date);for(const key of new Set([...Object.keys(x.accounts),...Object.keys(y.accounts)]))push(`${date} · ${key} closing`,x.accounts[key]||0,y.accounts[key]||0)}
 return result;
}
export function deleteEntry(l:Ledger,id:string){const old=l.entries.find(e=>e.id===id);if(!old)throw Error('Entry not found.');return replayEditedLedger({...l,entries:l.entries.map(e=>e.id===id?{...e,original:e.kind==='legacy'?(e.original||{...e}):e.original,deleted:true}:e)},old)}
// Both ordinary edits and whole-ledger replacements run independent integrity checks.
// Only the API can select replacement mode; a reason string has no authority.
export function validateState(input:Ledger):Ledger{
 const n=normalize(input);validateLedger(n);validateReview(n);validateRefundLinks(n);validateParking(n);
 const positions=totals(n);
 const ids=new Set<string>(),keys=new Set<string>();
 for(const p of n.people!){if(!p.id||!p.key||!p.name.trim()||ids.has(p.id)||keys.has(p.key)||!Array.isArray(p.aliases))throw Error('Invalid or duplicate person identity.');ids.add(p.id);keys.add(p.key);if(p.archived){const b=positions.people[p.key];if(b&&(b.receivable!==0||b.payable!==0)||(positions.groupPeople[p.key]||0)!==0)throw Error('An archived person cannot have an outstanding personal or group balance.')}}
 validateLedgerItems(n);
 const replayed=new Map(reflow(n).entries.map(e=>[e.id,e.effects]));
 for(const e of n.entries){
 if(e.original){if(e.original.id!==e.id||e.original.kind!=='legacy'||e.original.original)throw Error('Invalid original Excel identity.');validateLedger({...n,entries:[e.original]})}
 if(e.kind!=='legacy'&&!e.deleted&&JSON.stringify(e.effects)!==JSON.stringify(replayed.get(e.id)))throw Error(`${e.date} · ${e.description}: transaction effects are inconsistent.`);
 }
 return n;
}
const stable=(value:any):string=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined).sort(([a],[b])=>a.localeCompare(b))):v);
export function checkTransition(previous:Ledger,next:Ledger,reason:string,mode:'edit'|'replacement'='edit'){
 const old=normalize(previous),n=validateState(next);
 const nextEntries=new Map(n.entries.map(e=>[e.id,e]));
 // Known originals stay immutable even when restoring an older valid version.
 for(const e of old.entries){const q=nextEntries.get(e.id);if(!q)continue;
 if(e.original){const baseline=q.original||(q.kind==='legacy'?q:null);if(!baseline||stable(e.original)!==stable(baseline))throw Error('Original Excel values cannot be overwritten.');}
 }
 if(mode==='replacement')return n;
 const previousEntries=new Map(old.entries.map(e=>[e.id,e]));
 for(const entry of n.entries)if(!entry.deleted)checkActiveEntryItems(n,entry,previousEntries.get(entry.id));
 validateParkingTransition(old,n);
 for(const name of old.extraAccounts||[])if(!n.extraAccounts?.includes(name))throw Error('Keep account identities and history.');
 for(const e of n.entries)if(e.kind==='legacy'&&previousEntries.get(e.id)?.kind!=='legacy')throw Error('New Excel history must use the import workflow.');
 for(const p of old.people!){const q=n.people!.find(x=>x.id===p.id);if(!q||(!p.archived&&q.archived)){const balance=totals(n).people[p.key]||{receivable:0,payable:0};if(balance.receivable!==0||balance.payable!==0||(totals(n).groupPeople[p.key]||0)!==0)throw Error('Unsettled people cannot be removed or archived.');if(!q&&hasPersonHistory(old,p.key))throw Error('People with history must be archived, not deleted.');}if(q&&q.key!==p.key)throw Error('A person’s transaction identity cannot be changed.');}
 const changed=old.entries.filter(e=>JSON.stringify(e)!==JSON.stringify(nextEntries.get(e.id)));
 if(changed.length&&!reason.trim())throw Error('A reason is required for transaction changes.');
 for(const e of old.entries){const q=nextEntries.get(e.id);if(!q)throw Error('Use recoverable deletion; transaction history must be retained.');if(e.original&&stable(e.original)!==stable(q.original))throw Error('Original Excel values cannot be overwritten.');if(e.kind==='legacy'&&JSON.stringify(e)!==JSON.stringify(q)&&stable(q.original)!==stable(e.original||e))throw Error('Preserve the original Excel entry when correcting it.');}
 for(const p of n.people!){const previous=old.people!.find(x=>x.id===p.id);if((!previous||previous.name!==p.name)&&n.people!.some(x=>x.id!==p.id&&x.mergedInto!==p.key&&p.mergedInto!==x.key&&[x.key,x.name,...x.aliases].some(name=>identity(name)===identity(p.name))))throw Error('Duplicate person name or alias.');}
 return n;
}
export function appendAudit(old:Ledger,next:Ledger,reason:string):Ledger{
 const now=new Date().toISOString(),audit=[...(old.audit||[])];
 const previousEntries=new Map(old.entries.map(e=>[e.id,e]));
 const snapshot=(e:Entry|undefined)=>{if(!e)return null;const {original,...rest}=e;return rest};
 for(const e of next.entries){const prev=previousEntries.get(e.id);if(JSON.stringify(prev)!==JSON.stringify(e))audit.push({id:crypto.randomUUID(),at:now,action:!prev?'Added':e.deleted&&!prev.deleted?'Deleted':'Edited',target:e.id,reason,before:snapshot(prev),after:snapshot(e)})}
 const a=normalize(old).people!,b=normalize(next).people!;for(const p of b){const prev=a.find(x=>x.id===p.id);if(JSON.stringify(prev)!==JSON.stringify(p))audit.push({id:crypto.randomUUID(),at:now,action:!prev?'Person added':p.archived&&!prev.archived?'Person archived':!p.archived&&prev.archived?'Person restored':'Person renamed',target:p.id,reason,before:prev||null,after:p})}for(const p of a)if(!b.some(x=>x.id===p.id))audit.push({id:crypto.randomUUID(),at:now,action:'Person deleted',target:p.id,reason,before:p,after:null});
 for(const key of ['checkpoints','items','food','duplicateAcknowledgements'] as const){if(JSON.stringify(old.review?.[key])!==JSON.stringify(next.review?.[key]))audit.push({id:crypto.randomUUID(),at:now,action:'Review updated',target:'review:'+key,reason,before:old.review?.[key]||null,after:next.review?.[key]||null})}
 if(stable(old.refundLinks||[])!==stable(next.refundLinks||[]))audit.push({id:crypto.randomUUID(),at:now,action:'Existing refund links updated',target:'refundLinks',reason,before:old.refundLinks||[],after:next.refundLinks||[]});
 for(const key of ['accountSettings','categorySettings','extraAccounts','confirmedBankAllocation','accountTypes','extraCategories','categoryTypes','shortcuts','tailoringVersion'] as const)if(stable(old[key])!==stable(next[key]))audit.push({id:crypto.randomUUID(),at:now,action:'Accounts updated',target:key,reason,before:old[key]||null,after:next[key]||null});
 return {...next,audit};
}
