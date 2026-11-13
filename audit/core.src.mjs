import {makeEntry,totals,report,reflow,emptyEffects,validateLedger} from '../lib/ledger.ts';
import {prepareEntry,deleteEntry,normalize,validateState,checkTransition,appendAudit,previewChanges} from '../lib/v2.ts';
import {createParkingTransfer,parkingSummary,setParkingLinks,validateParking,savingsTransfers} from '../lib/parking.ts';

let pass=0,fail=0;const failures=[];
const eq=(name,actual,expected)=>{const a=JSON.stringify(actual),e=JSON.stringify(expected);if(a===e){pass++;console.log('  PASS',name)}else{fail++;failures.push(name);console.log('  FAIL',name,'\n       expected',e,'\n       actual  ',a)}};
const throws=(name,fn,re)=>{try{fn();fail++;failures.push(name);console.log('  FAIL',name,'- expected rejection, but it was accepted')}catch(e){if(re&&!re.test(e.message)){fail++;failures.push(name);console.log('  FAIL',name,'- rejected with unexpected message:',e.message)}else{pass++;console.log('  PASS',name,'(rejected:',e.message.slice(0,70)+')')}}};
const rs=n=>Math.round(n*100);
let uid=0;
const base=()=>({version:1,baselineDate:'2026-07-31',openings:{Alfalah:rs(50000),NayaPay:0,'BOP Savings':0,NBP:0,Cash:0,'Legacy Current':0},openingPeople:{},entries:[],reference:[],sourceName:'audit',includeSplitwise:false,splitwiseOpening:0,splitwiseOpeningDate:'2026-07-31',accountStatus:''});
const mk=(f)=>({id:f.id||('e'+(++uid)),date:f.date,month:f.month||f.date.slice(0,7),description:f.description||f.kind,kind:f.kind,category:f.category??'',amount:f.amount,account:f.account??'Alfalah',person:f.person??'',notes:f.notes??'',effects:emptyEffects(),...(f.to?{to:f.to}:{}),...(f.ownShare!=null?{ownShare:f.ownShare}:{}),...(f.splits?{splits:f.splits}:{}),...(f.recoveries?{recoveries:f.recoveries}:{})});
const add=(l,f)=>prepareEntry(l,mk(f));
const bal=(l,a,d)=>totals(l,d).accounts[a]||0;
const lastId=l=>l.entries[l.entries.length-1].id;

console.log('\n=== A. ACCOUNTING: hand-derived expectations ===');
{
 let l=base();
 l=add(l,{date:'2026-10-01',kind:'income',category:'Salary',amount:rs(100000),description:'Oct salary'});
 l=add(l,{date:'2026-10-03',kind:'expense',category:'Rent',amount:rs(40000)});
 l=add(l,{date:'2026-10-05',kind:'expense',category:'Grocery',amount:rs(30000)});
 l=add(l,{date:'2026-10-20',kind:'transfer',amount:rs(5000),account:'Alfalah',to:'Cash'});
 l=add(l,{date:'2026-10-25',kind:'lend',amount:rs(10000),person:'Ali'});
 const t=totals(l),r=report(l,'2026-10');
 eq('Oct income Rs100,000',r.income,rs(100000));
 eq('Oct spending Rs70,000',r.spend,rs(70000));
 eq('Oct surplus Rs30,000 (cash & IOU not added again)',r.surplus,rs(30000));
 eq('category split',r.categories,{Rent:rs(40000),Grocery:rs(30000)});
 eq('Alfalah = 50k+100k-70k-5k-10k = 65k',t.accounts.Alfalah,rs(65000));
 eq('Cash = 5k',t.accounts.Cash,rs(5000));
 eq('Ali owes 10k',t.people.Ali,{receivable:rs(10000),payable:0});
 eq('net worth = opening 50k + surplus 30k',t.netWorth,rs(80000));
 globalThis.OCT=l;
 // repayment neutrality
 let m=add(l,{date:'2026-11-03',kind:'repaymentIn',amount:rs(10000),person:'Ali'});
 eq('repayment: net worth unchanged',totals(m).netWorth,rs(80000));
 eq('repayment: Nov income 0 / spend 0',[report(m,'2026-11').income,report(m,'2026-11').spend],[0,0]);
 eq('repayment: Oct surplus unchanged',report(m,'2026-10').surplus,rs(30000));
 throws('repayment above balance rejected',()=>add(l,{date:'2026-11-03',kind:'repaymentIn',amount:rs(10000.01),person:'Ali'}));
 throws('repayment BEFORE the loan date rejected',()=>add(l,{date:'2026-10-24',kind:'repaymentIn',amount:rs(1),person:'Ali'}));
 // shared purchase 3000: own 1000, A 1000, B 1000
 let s=add(l,{date:'2026-10-26',kind:'shared',category:'Food',amount:rs(3000),ownShare:rs(1000),splits:[{person:'Sara',amount:rs(1000)},{person:'Bilal',amount:rs(1000)}]});
 eq('shared: spend only own share',report(s,'2026-10').spend,rs(71000));
 eq('shared: net worth falls by own share only',totals(s).netWorth,rs(79000));
 throws('shared: shares not closing exactly',()=>add(l,{date:'2026-10-26',kind:'shared',category:'Food',amount:rs(3000),ownShare:rs(1000),splits:[{person:'Sara',amount:rs(1000)},{person:'Bilal',amount:rs(999.99)}]}));
 // someone pays my share: Ali owes 10k, pays my 12k share -> offsets 10k, I owe 2k
 let p=add(l,{date:'2026-10-27',kind:'personExpense',category:'Food',amount:rs(12000),person:'Ali'});
 eq('personExpense: receivable cleared',totals(p).people.Ali,{receivable:0,payable:rs(2000)});
 eq('personExpense: spend counted',report(p,'2026-10').spend,rs(82000));
 eq('personExpense: NW falls by exactly my share',totals(p).netWorth,rs(80000-12000));
 // transfer neutrality / report month vs actual date
 let x=add(l,{date:'2026-11-01',month:'2026-10',kind:'expense',category:'Misc',amount:rs(1000)});
 eq('Report Month beats actual date: Oct spend',report(x,'2026-10').spend,rs(71000));
 eq('...and Nov spend is 0',report(x,'2026-11').spend,0);
 eq('...but balance moves on actual date (Oct 31 unchanged)',bal(x,'Alfalah','2026-10-31'),rs(65000));
 eq('...and Nov 1 reduced',bal(x,'Alfalah','2026-11-01'),rs(64000));
 // refund / recovery example: 19,115 purchase, 12,053 recovery -> 7,062 net
 let q=add(base(),{date:'2026-10-02',kind:'expense',category:'Health',amount:rs(19115),id:'med'});
 q=prepareEntry(q,{...mk({date:'2026-10-10',kind:'officeRecovery',amount:rs(12053),category:'',description:'office'}),recoveries:[{expenseId:'med',category:'Health',amount:rs(12053)}]});
 eq('recovery: net Health spend 7,062',report(q,'2026-10').categories.Health,rs(7062));
 eq('recovery: no income created',report(q,'2026-10').income,0);
 throws('recovery above remaining personal expense rejected',()=>prepareEntry(q,{...mk({date:'2026-10-11',kind:'officeRecovery',amount:rs(7062.01),category:'',description:'o2'}),recoveries:[{expenseId:'med',category:'Health',amount:rs(7062.01)}]}));
 // validation edge cases
 throws('zero amount rejected',()=>add(base(),{date:'2026-10-01',kind:'expense',category:'Food',amount:0}));
 throws('date before baseline rejected',()=>add(base(),{date:'2026-07-30',kind:'expense',category:'Food',amount:100}));
 throws('impossible date 2026-02-30 rejected',()=>add(base(),{date:'2026-02-30',kind:'expense',category:'Food',amount:100}));
 throws('transfer to same account rejected',()=>add(base(),{date:'2026-10-01',kind:'transfer',amount:100,account:'Cash',to:'Cash'}));
 throws('unknown account rejected',()=>add(base(),{date:'2026-10-01',kind:'expense',category:'Food',amount:100,account:'Nope'}));
}
console.log(`\nSUMMARY pass=${pass} fail=${fail}`);if(fail)console.log('FAILED:',failures);
export {eq,throws,rs,add,mk,bal,base,lastId,pass,fail,failures};
