import {totals,report,reflow,emptyEffects} from '../lib/ledger.ts';
import {prepareEntry,deleteEntry,normalize,validateState,checkTransition,appendAudit} from '../lib/v2.ts';
import {eq,throws,rs,add,mk,bal,base,lastId} from './core.src.mjs';

const ids=l=>l.entries.map(e=>e.id);
console.log('\n=== B1. EDITING / DELETION: hand-derived cascades ===');
{
 let l=base();
 l=add(l,{date:'2026-10-01',kind:'income',category:'Salary',amount:rs(100000),id:'sal'});
 l=add(l,{date:'2026-10-05',kind:'lend',amount:rs(10000),person:'Ali',id:'lend'});
 l=add(l,{date:'2026-10-20',kind:'repaymentIn',amount:rs(10000),person:'Ali',id:'rep'});
 throws('delete a loan that has a later repayment',()=>deleteEntry(l,'lend'),/rep/);
 const lend=l.entries.find(e=>e.id==='lend');
 throws('edit loan DOWN below later repayment',()=>prepareEntry(l,{...lend,amount:rs(4000)},lend));
 throws('edit loan DATE after its repayment',()=>prepareEntry(l,{...lend,date:'2026-10-21'},lend));
 const rep=l.entries.find(e=>e.id==='rep');
 throws('edit repayment date BEFORE loan',()=>prepareEntry(l,{...rep,date:'2026-10-04'},rep));
 let d=deleteEntry(l,'rep');d=deleteEntry(d,'lend');
 eq('delete repayment then loan (right order): Alfalah back to opening+salary',bal(d,'Alfalah'),rs(150000));
 eq('...no residual IOU',totals(d).people.Ali??{receivable:0,payable:0},{receivable:0,payable:0});
 eq('edit loan UP is allowed and cascades',totals(prepareEntry(l,{...lend,amount:rs(12000)},lend)).people.Ali,{receivable:rs(2000),payable:0});
}
{
 // personExpense depends on receivable at its date -> editing the loan must re-derive it
 let l=base();
 l=add(l,{date:'2026-10-01',kind:'lend',amount:rs(10000),person:'Ali',id:'lend'});
 l=add(l,{date:'2026-10-10',kind:'personExpense',category:'Food',amount:rs(12000),person:'Ali',id:'pe'});
 eq('before edit: Ali clear, I owe 2k',totals(l).people.Ali,{receivable:0,payable:rs(2000)});
 const lend=l.entries[0];
 const l2=prepareEntry(l,{...lend,amount:rs(4000)},lend);
 eq('loan edited to 4k: offset re-derived => I owe 8k',totals(l2).people.Ali,{receivable:0,payable:rs(8000)});
 eq('...net worth moved by exactly the loan change (-6k lent => +6k cash, -6k offset... NW unchanged vs spend)',totals(l2).netWorth,totals(l).netWorth);
 const l3=deleteEntry(l,'lend');
 eq('loan deleted: whole 12k is payable',totals(l3).people.Ali,{receivable:0,payable:rs(12000)});
 eq('...spend still 12k',report(l3,'2026-10').spend,rs(12000));
}
{
 // deleted == never entered
 let a=base(),b=base();
 const ops=[{date:'2026-10-01',kind:'income',category:'Salary',amount:rs(90000)},{date:'2026-10-02',kind:'expense',category:'Food',amount:rs(500),id:'x'},{date:'2026-11-02',kind:'expense',category:'Rent',amount:rs(20000)}];
 for(const o of ops){a=add(a,o);if(o.id!=='x')b=add(b,o)}
 a=deleteEntry(a,'x');
 eq('delete == never entered (totals)',[totals(a).accounts,totals(a).netWorth],[totals(b).accounts,totals(b).netWorth]);
 eq('delete == never entered (reports)',[report(a,'2026-10'),report(a,'2026-11')],[report(b,'2026-10'),report(b,'2026-11')]);
 eq('deleted entry kept (recoverable)',a.entries.find(e=>e.id==='x')?.deleted,true);
 // restore
 const r=reflow({...a,entries:a.entries.map(e=>e.id==='x'?{...e,deleted:false}:e)});
 eq('restore brings the expense back',report(r,'2026-10').spend,rs(500));
 // edit account / month / amount
 const x=r.entries.find(e=>e.id==='x');
 const m=prepareEntry(r,{...x,account:'NayaPay',month:'2026-11',amount:rs(750)},x);
 eq('edit: NayaPay -750, Alfalah unchanged by it',[bal(m,'NayaPay'),bal(m,'Alfalah')],[-rs(750),rs(50000)+rs(90000)-rs(20000)]);
 eq('edit: spend moved Oct->Nov',[report(m,'2026-10').spend,report(m,'2026-11').spend],[0,rs(20750)]);
}
{
 // linked recovery blocks deletion/reduction of the purchase
 let l=add(base(),{date:'2026-10-02',kind:'expense',category:'Health',amount:rs(19115),id:'med'});
 l=prepareEntry(l,{...mk({date:'2026-10-10',kind:'officeRecovery',amount:rs(12053),description:'office',id:'rec'}),recoveries:[{expenseId:'med',category:'Health',amount:rs(12053)}]});
 throws('delete a purchase that has a linked recovery',()=>deleteEntry(l,'med'));
 const med=l.entries[0];
 throws('reduce purchase below recovered amount',()=>prepareEntry(l,{...med,amount:rs(10000)},med));
 eq('reduce purchase to exactly 12,053 is allowed',report(prepareEntry(l,{...med,amount:rs(12053)},med),'2026-10').spend,0);
}
console.log('\n=== B2. AUDIT / SAVE-LEVEL RULES ===');
{
 let l=normalize(add(base(),{date:'2026-10-02',kind:'expense',category:'Food',amount:500,id:'x'}));
 const del=deleteEntry(l,'x');
 const checked=checkTransition(l,del,'because','edit');
 const withAudit=appendAudit(l,checked,'because');
 eq('audit records one Deleted action with reason',withAudit.audit.filter(a=>a.action==='Deleted').map(a=>[a.target,a.reason]),[['x','because']]);
 throws('transaction change with empty reason rejected by checkTransition',()=>checkTransition(l,del,'  ','edit'),/reason/i);
 // hard-removing an entry (not soft delete) must be rejected
 throws('hard removal of a transaction rejected',()=>checkTransition(l,{...l,entries:[]},'r','edit'));
 // tampered effects
 const forged={...l,entries:l.entries.map(e=>({...e,effects:{...e.effects,accounts:{Alfalah:-1}}}))};
 throws('forged effects rejected',()=>validateState(forged),/inconsistent/);
 // tampering with something a client should not be able to change
 const dupId={...l,entries:[...l.entries,l.entries[0]]};
 throws('duplicate IDs rejected',()=>validateState(dupId));
}
console.log('\n=== B3. SIDE OBSERVATIONS (not pass/fail: spec is silent) ===');
{
 let l=base();
 l=add(l,{date:'2026-10-01',kind:'income',category:'Salary',amount:rs(1000),id:'sal'});
 l=add(l,{date:'2026-10-02',kind:'expense',category:'Food',amount:rs(900)});
 const d=deleteEntry(l,'sal');
 console.log('  OBSERVE deleting the income that funded later spending is accepted; Alfalah ends at',bal(d,'Alfalah')/100,'(opening Rs50,000 so still positive here)');
 let n=add(base(),{date:'2026-10-01',kind:'transfer',amount:rs(2000),account:'Alfalah',to:'Cash',id:'wd'});
 n=add(n,{date:'2026-10-02',kind:'expense',category:'Food',amount:rs(1500),account:'Cash'});
 const nd=deleteEntry(n,'wd');
 console.log('  OBSERVE deleting a cash withdrawal that funded a Cash expense is accepted; Cash ends at Rs',bal(nd,'Cash')/100);
 try{add(base(),{date:'2026-10-01',kind:'expense',category:'Food',amount:rs(999999),account:'Cash'});console.log('  OBSERVE spending Rs999,999 from an empty Cash account is accepted (no negative-balance guard)')}catch(e){console.log('  OBSERVE overdraw rejected:',e.message)}
}
