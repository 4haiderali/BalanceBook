import {totals,report,reflow,emptyEffects} from '../lib/ledger.ts';
import {prepareEntry,deleteEntry,normalize,checkTransition,validateState} from '../lib/v2.ts';
import {createParkingTransfer,parkingSummary,setParkingLinks,savingsTransfers} from '../lib/parking.ts';
import {eq,throws,rs,add,mk,bal,base} from './core.src.mjs';
const S=(l,m,asOf)=>{const s=parkingSummary(l,m,asOf);return{surplus:s.surplus,parked:s.parked,future:s.future,remaining:s.remaining,unallocated:s.unallocated,over:s.overParked}};
const park=(l,month,date,amount,from='Alfalah',to='BOP Savings')=>createParkingTransfer(l,{month,date,amount:rs(amount),from,to});
const OCT=(()=>{let l=base();
 l=add(l,{date:'2026-10-01',kind:'income',category:'Salary',amount:rs(100000)});
 l=add(l,{date:'2026-10-03',kind:'expense',category:'Rent',amount:rs(40000),id:'rent'});
 l=add(l,{date:'2026-10-05',kind:'expense',category:'Grocery',amount:rs(30000)});
 l=add(l,{date:'2026-10-20',kind:'transfer',amount:rs(5000),account:'Alfalah',to:'Cash'});
 l=add(l,{date:'2026-10-25',kind:'lend',amount:rs(10000),person:'Ali'});return l})();
console.log('\n=== C. MONTH-END PARKING ===');
{
 eq('start: Oct surplus 30,000, nothing parked',S(OCT,'2026-10'),{surplus:rs(30000),parked:0,future:0,remaining:rs(30000),unallocated:rs(30000),over:0});
 const p=park(OCT,'2026-10','2026-11-05',30000);
 const t=totals(p),tr=p.entries[p.entries.length-1];
 eq('park full 30k: summary',S(p,'2026-10'),{surplus:rs(30000),parked:rs(30000),future:0,remaining:0,unallocated:0,over:0});
 eq('park: net worth unchanged (80k)',t.netWorth,rs(80000));
 eq('park: Alfalah 35k, Savings 30k',[t.accounts.Alfalah,t.accounts['BOP Savings']],[rs(35000),rs(30000)]);
 eq('park: transfer is Nov (actual date), not Oct',[tr.date,tr.month],['2026-11-05','2026-11']);
 eq('park: creates no income/spending anywhere',[report(p,'2026-10').spend,report(p,'2026-10').income,report(p,'2026-11').spend,report(p,'2026-11').income],[rs(70000),rs(100000),0,0]);
 // caps
 throws('park 30,000.01 > surplus',()=>park(OCT,'2026-10','2026-11-05',30000.01));
 let h=park(OCT,'2026-10','2026-11-05',20000);
 eq('partial 20k: remaining 10k',S(h,'2026-10').remaining,rs(10000));
 throws('second park 10,000.01 > remaining',()=>park(h,'2026-10','2026-11-06',10000.01));
 let h2=park(h,'2026-10','2026-11-06',10000);
 throws('after fully parked, even 0.01 more rejected (duplicate cap)',()=>park(h2,'2026-10','2026-11-07',0.01));
 // balance
 throws('paying account with too-low balance',()=>park(OCT,'2026-10','2026-11-05',100,'NayaPay'));
 throws('paying from a Savings account',()=>park(OCT,'2026-10','2026-11-05',100,'BOP Savings','BOP Savings'));
 throws('destination not a Savings account',()=>park(OCT,'2026-10','2026-11-05',100,'Alfalah','Cash'));
 throws('month before Aug 2026',()=>park(OCT,'2026-07','2026-11-05',100));
 throws('invalid month 2026-13',()=>park(OCT,'2026-13','2026-11-05',100));
 throws('transfer dated BEFORE its surplus month (future surplus)',()=>park(OCT,'2026-10','2026-09-30',100));
 throws('zero/negative amount',()=>park(OCT,'2026-10','2026-11-05',0));
 throws('impossible actual date',()=>park(OCT,'2026-10','2026-11-31',100));
 // deficit month
 let sep=add(base(),{date:'2026-09-10',kind:'expense',category:'Food',amount:rs(1000)});
 eq('deficit month: surplus -1,000, target 0',S(sep,'2026-09'),{surplus:-rs(1000),parked:0,future:0,remaining:0,unallocated:0,over:0});
 throws('cannot park a deficit month',()=>park(sep,'2026-09','2026-10-05',1));
 // later repayment neutrality and deletion
 let r=add(p,{date:'2026-11-20',kind:'repaymentIn',amount:rs(10000),person:'Ali'});
 eq('later repayment: Oct summary unchanged, no new task',S(r,'2026-10'),S(p,'2026-10'));
 eq('later repayment: net worth still 80k',totals(r).netWorth,rs(80000));
 const d=deleteEntry(p,tr.id);
 eq('delete parking transfer reopens the full 30k',S(d,'2026-10'),S(OCT,'2026-10'));
 eq('delete parking transfer restores account balances',[bal(d,'Alfalah'),bal(d,'BOP Savings')],[rs(65000),0]);
 // future dated
 const f=park(OCT,'2026-10','2026-12-15',30000);
 eq('future-dated (asOf Nov 9): reserved, not yet parked',S(f,'2026-10','2026-11-09'),{surplus:rs(30000),parked:0,future:rs(30000),remaining:rs(30000),unallocated:0,over:0});
 eq('future-dated (asOf Dec 15): counted as parked',S(f,'2026-10','2026-12-15').parked,rs(30000));
 // correcting an expense after parking: allowed, shows excess
 const rent=p.entries.find(e=>e.id==='rent');
 const up=prepareEntry(p,{...rent,amount:rs(45000)},rent);
 eq('expense raised after parking: accepted; surplus 25k, 5k over-parked',S(up,'2026-10'),{surplus:rs(25000),parked:rs(30000),future:0,remaining:0,unallocated:0,over:rs(5000)});
 throws('...but cannot park another paisa while over-parked',()=>park(up,'2026-10','2026-11-08',0.01));
 // editing the parking transfer itself
 const tr2=p.entries.find(e=>e.parking);
 throws('reduce transfer below its 30k allocation',()=>prepareEntry(p,{...tr2,amount:rs(20000)},tr2),/allocation|exceed/i);
 eq('increase transfer to 40k keeps allocation 30k',S(prepareEntry(p,{...tr2,amount:rs(40000)},tr2),'2026-10').parked,rs(30000));
 throws('move transfer date before its surplus month',()=>prepareEntry(p,{...tr2,date:'2026-09-30'},tr2));
 // in-progress month then more spending
 let nov=base();nov=add(nov,{date:'2026-11-01',kind:'income',category:'Salary',amount:rs(100000)});nov=add(nov,{date:'2026-11-02',kind:'expense',category:'Food',amount:rs(10000)});
 nov=park(nov,'2026-11','2026-11-05',90000);nov=add(nov,{date:'2026-11-20',kind:'expense',category:'Food',amount:rs(50000)});
 eq('in-progress month overspent after parking: excess shown, not blocked',S(nov,'2026-11'),{surplus:rs(40000),parked:rs(90000),future:0,remaining:0,unallocated:0,over:rs(50000)});
}
console.log('\n=== C2. "NOVEMBER SURPLUS PAID FROM DECEMBER SALARY" ===');
{
 let l={...base(),openings:{Alfalah:0,NayaPay:0,'BOP Savings':0,NBP:0,Cash:0,'Legacy Current':0}};
 l=add(l,{date:'2026-11-01',kind:'income',category:'Salary',amount:rs(100000)});
 l=add(l,{date:'2026-11-05',kind:'expense',category:'Rent',amount:rs(60000)});
 l=add(l,{date:'2026-11-25',kind:'lend',amount:rs(40000),person:'Ali'});
 eq('Nov surplus 40k, Alfalah empty on Nov 28',[S(l,'2026-11').surplus,bal(l,'Alfalah','2026-11-28')],[rs(40000),0]);
 throws('cannot park on Nov 28 (balance is 0)',()=>park(l,'2026-11','2026-11-28',40000));
 l=add(l,{date:'2026-12-01',kind:'income',category:'Salary',amount:rs(100000),description:'Dec salary'});
 const p=park(l,'2026-11','2026-12-01',40000);
 eq('Dec salary funds Nov parking: Nov remaining 0',S(p,'2026-11').remaining,0);
 eq('...Dec income/spend untouched (100k / 0)',[report(p,'2026-12').income,report(p,'2026-12').spend],[rs(100000),0]);
 eq('...net worth unchanged by parking',totals(p).netWorth,totals(l).netWorth);
 const back=add(p,{date:'2027-01-10',kind:'repaymentIn',amount:rs(40000),person:'Ali'});
 eq('Ali repays in Jan: no new surplus, Nov target stays 40k',S(back,'2026-11').surplus,rs(40000));
 eq('...Jan income 0',report(back,'2027-01').income,0);
 const y=park(l,'2026-11','2026-12-01',40000);const jan=add(y,{date:'2027-01-02',kind:'income',category:'Salary',amount:rs(1000),month:'2027-01'});
 eq('year rollover month 2027-01 works',report(jan,'2027-01').income,rs(1000));
}
console.log('\n=== C3. LINKING EXISTING TRANSFERS ===');
{
 let l=OCT;
 l=add(l,{date:'2026-10-28',kind:'transfer',amount:rs(20000),account:'Alfalah',to:'BOP Savings',id:'tx'});
 eq('plain Savings transfer is a link candidate',savingsTransfers(l).map(e=>e.id),['tx']);
 const a=setParkingLinks(l,'tx','BOP Savings',[{month:'2026-10',amount:rs(15000)}]);
 eq('link 15k to Oct: parked 15k, no new money moved',[S(a,'2026-10').parked,totals(a).netWorth,bal(a,'BOP Savings')],[rs(15000),totals(l).netWorth,rs(20000)]);
 throws('link more than the transfer (20,000.01)',()=>setParkingLinks(l,'tx','BOP Savings',[{month:'2026-10',amount:rs(20000.01)}]));
 // second month
 let m=add(l,{date:'2026-09-02',kind:'income',category:'Salary',amount:rs(10000)});m=add(m,{date:'2026-09-03',kind:'expense',category:'Food',amount:rs(2000)});
 const two=setParkingLinks(m,'tx','BOP Savings',[{month:'2026-09',amount:rs(8000)},{month:'2026-10',amount:rs(12000)}]);
 eq('one transfer covers two months',[S(two,'2026-09').parked,S(two,'2026-10').parked],[rs(8000),rs(12000)]);
 throws('Sep link above Sep surplus (8,000.01)',()=>setParkingLinks(m,'tx','BOP Savings',[{month:'2026-09',amount:rs(8000.01)}]));
 throws('two months exceed transfer',()=>setParkingLinks(m,'tx','BOP Savings',[{month:'2026-09',amount:rs(8000)},{month:'2026-10',amount:rs(12000.01)}]));
 throws('same month listed twice',()=>setParkingLinks(l,'tx','BOP Savings',[{month:'2026-10',amount:100},{month:'2026-10',amount:100}]));
 const cleared=setParkingLinks(a,'tx','BOP Savings',[]);
 eq('clearing links keeps the bank transaction',[cleared.entries.some(e=>e.id==='tx'&&!e.deleted),S(cleared,'2026-10').parked],[true,0]);
 // double counting across two transfers
 let dbl=add(l,{date:'2026-10-29',kind:'transfer',amount:rs(30000),account:'Alfalah',to:'BOP Savings',id:'tx2'});
 dbl=setParkingLinks(dbl,'tx2','BOP Savings',[{month:'2026-10',amount:rs(30000)}]);
 throws('second transfer cannot also cover the same 30k surplus',()=>setParkingLinks(dbl,'tx','BOP Savings',[{month:'2026-10',amount:rs(1)}]));
 // non-transfer / non-savings
 throws('cannot attach parking to an expense',()=>setParkingLinks(l,'rent','BOP Savings',[{month:'2026-10',amount:100}]));
 let cw=add(l,{date:'2026-10-29',kind:'transfer',amount:rs(1000),account:'Alfalah',to:'Cash',id:'cw'});
 throws('transfer into Cash is not Savings parking',()=>setParkingLinks(cw,'cw','Cash',[{month:'2026-10',amount:100}]));
}
console.log('\n=== C4. FORGED PARKING VIA DIRECT SAVE (bypassing the UI) ===');
{
 const prev=normalize(OCT);
 const tryNext=(mutate)=>{const next=normalize(mutate(structuredClone(prev)));return checkTransition(prev,next,'forge','edit')};
 throws('parking on an expense',()=>tryNext(l=>{l.entries.find(e=>e.id==='rent').parking={destination:'BOP Savings',allocations:[{month:'2026-10',amount:100}]};return l}));
 let withTx=normalize(add(OCT,{date:'2026-10-28',kind:'transfer',amount:rs(50000),account:'Alfalah',to:'BOP Savings',id:'tx'}));
 const tryTx=(alloc)=>checkTransition(withTx,normalize({...structuredClone(withTx),entries:withTx.entries.map(e=>e.id==='tx'?{...e,parking:{destination:'BOP Savings',allocations:alloc}}:e)}),'forge','edit');
 throws('direct save: allocation above surplus (35k vs 30k)',()=>tryTx([{month:'2026-10',amount:rs(35000)}]));
 throws('direct save: negative allocation',()=>tryTx([{month:'2026-10',amount:-5}]));
 throws('direct save: fractional paisa allocation',()=>tryTx([{month:'2026-10',amount:100.5}]));
 throws('direct save: future surplus month',()=>tryTx([{month:'2027-05',amount:100}]));
 throws('direct save: empty allocations array',()=>tryTx([]));
 eq('direct save: legitimate 30k link accepted',!!tryTx([{month:'2026-10',amount:rs(30000)}]),true);
}
console.log('\n=== C5. GAP PROBES (code-reading suspicions) ===');
{
 // Suspicion: balance guard only checks the transfer date, not later dates
 let l={...base(),openings:{Alfalah:0,NayaPay:0,'BOP Savings':0,NBP:0,Cash:0,'Legacy Current':0}};
 l=add(l,{date:'2026-10-01',kind:'income',category:'Salary',amount:rs(100000)});
 l=add(l,{date:'2026-10-20',kind:'lend',amount:rs(95000),person:'Ali'});
 let accepted=true,p;try{p=park(l,'2026-10','2026-10-02',100000)}catch(e){accepted=false}
 if(accepted){const min=Math.min(...['2026-10-02','2026-10-19','2026-10-20','2026-10-31'].map(d=>bal(p,'Alfalah',d)));
  console.log('  FINDING backdated parking accepted although it makes Alfalah negative later: lowest balance Rs',min/100,'(on Oct 20 the lend of 95,000 can no longer be paid)');}
 else console.log('  backdated parking correctly rejected');
 eq('backdated parking that would overdraw the account on a LATER date is rejected',accepted,false);
}

// Server guard: a direct save must enforce the same chronology as the form.
{
 let l={...base(),openings:{Alfalah:0,NayaPay:0,'BOP Savings':0,NBP:0,Cash:0,'Legacy Current':0}};
 l=add(l,{date:'2026-10-01',kind:'income',category:'Salary',amount:rs(100000)});
 l=add(l,{date:'2026-10-20',kind:'lend',amount:rs(95000),person:'Ali'});
 const before=normalize(l);
 throws('direct save rejects later overdraft from backdated parking',()=>{
  let next=add(before,{date:'2026-10-02',kind:'transfer',amount:rs(100000),account:'Alfalah',to:'BOP Savings',id:'forged-backdated'});
  next.entries.find(e=>e.id==='forged-backdated').parking={destination:'BOP Savings',allocations:[{month:'2026-10',amount:rs(100000)}]};
  return checkTransition(before,normalize(next),'Direct parking save','edit');
 });
}
