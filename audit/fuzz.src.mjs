import {totals,report,emptyEffects} from '../lib/ledger.ts';
import {prepareEntry,deleteEntry} from '../lib/v2.ts';

// ---------- independent reference model, written from the spec only ----------
function model(ops,opening){
 const acc={...opening},rec={},pay={},months={};
 const order=ops.map((o,i)=>[o,i]).sort((a,b)=>a[0].date<b[0].date?-1:a[0].date>b[0].date?1:a[1]-b[1]);
 const A=(k,n)=>acc[k]=(acc[k]||0)+n,R=(p,n)=>rec[p]=(rec[p]||0)+n,P=(p,n)=>pay[p]=(pay[p]||0)+n;
 const M=o=>months[o.month]??={income:0,spend:0};
 for(const [o] of order){const a=o.amount;
  switch(o.kind){
   case'expense':A(o.account,-a);M(o).spend+=a;break;
   case'refund':A(o.account,a);M(o).spend-=a;break;
   case'income':A(o.account,a);M(o).income+=a;break;
   case'transfer':A(o.account,-a);A(o.to,a);break;
   case'lend':A(o.account,-a);R(o.person,a);break;
   case'borrow':A(o.account,a);P(o.person,a);break;
   case'repaymentIn':if(a>(rec[o.person]||0))return{ok:false};A(o.account,a);R(o.person,-a);break;
   case'repaymentOut':if(a>(pay[o.person]||0))return{ok:false};A(o.account,-a);P(o.person,-a);break;
   case'personExpense':{const off=Math.min(a,rec[o.person]||0);M(o).spend+=a;R(o.person,-off);P(o.person,a-off);break}
   case'shared':A(o.account,-a);M(o).spend+=o.ownShare;for(const s of o.splits)R(s.person,s.amount);break;
  }}
 const sum=x=>Object.values(x).reduce((s,n)=>s+n,0);
 return{ok:true,acc,rec,pay,months,nw:sum(acc)+sum(rec)-sum(pay)};
}
// ---------- seeded generator ----------
let seed=Number(process.argv[2]||12345);const rnd=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const pick=a=>a[Math.floor(rnd()*a.length)];const ri=(a,b)=>a+Math.floor(rnd()*(b-a+1));
const ACCS=['Alfalah','NayaPay','Cash','BOP Savings'],PEOPLE=['Ali','Sara','Bilal'],CATS=['Food','Rent','Fuel','Misc'];
const dates=['2026-09-01','2026-09-15','2026-10-01','2026-10-02','2026-10-15','2026-10-31','2026-11-01','2026-11-02','2026-11-09','2026-12-01'];
let n=0;
function gen(){const kind=pick(['expense','expense','income','transfer','lend','borrow','repaymentIn','repaymentOut','personExpense','shared','refund','lend','repaymentIn']);
 const date=pick(dates),month=rnd()<.25?pick(['2026-09','2026-10','2026-11','2026-12']):date.slice(0,7),amount=ri(1,400000);
 const o={id:'g'+(++n),date,month,description:kind,kind,category:['expense','refund','personExpense','shared'].includes(kind)?pick(CATS):kind==='income'?'Salary':'',amount,account:pick(ACCS),person:['lend','borrow','repaymentIn','repaymentOut','personExpense'].includes(kind)?pick(PEOPLE):'',notes:''};
 if(kind==='transfer'){o.to=pick(ACCS.filter(a=>a!==o.account))}
 if(kind==='shared'){const k=ri(1,2),own=ri(0,amount-k);let rest=amount-own;o.ownShare=own;o.splits=[];for(let i=0;i<k;i++){const s=i===k-1?rest:ri(1,rest-(k-1-i));o.splits.push({person:PEOPLE[i],amount:s});rest-=s}}
 if(kind==='lend'||kind==='repaymentIn'){ if(rnd()<.6) o.amount=ri(1,50000)}
 return o}
const raw=o=>({...o,effects:emptyEffects()});
const opening={Alfalah:5000000,NayaPay:0,'BOP Savings':0,NBP:0,Cash:0,'Legacy Current':0};
const base=()=>({version:1,baselineDate:'2026-07-31',openings:{...opening},openingPeople:{},entries:[],reference:[],sourceName:'f',includeSplitwise:false,splitwiseOpening:0,splitwiseOpeningDate:'2026-07-31',accountStatus:''});
function compare(tag,l,ops,out){
 const m=model(ops,opening),t=totals(l);
 const acc=Object.fromEntries(Object.entries(t.accounts).filter(([,v])=>v));const macc=Object.fromEntries(Object.entries(m.acc).filter(([,v])=>v));
 const ppl={};for(const [k,v] of Object.entries(t.people))if(v.receivable||v.payable)ppl[k]=v;
 const mp={};for(const k of new Set([...Object.keys(m.rec),...Object.keys(m.pay)]))if(m.rec[k]||m.pay[k])mp[k]={receivable:m.rec[k]||0,payable:m.pay[k]||0};
 const bad=[];
 if(JSON.stringify(acc)!==JSON.stringify(Object.fromEntries(Object.entries(macc).sort(([a],[b])=>a<b?-1:1)))&&JSON.stringify(Object.entries(acc).sort())!==JSON.stringify(Object.entries(macc).sort()))bad.push(['accounts',acc,macc]);
 if(JSON.stringify(Object.entries(ppl).sort())!==JSON.stringify(Object.entries(mp).sort()))bad.push(['people',ppl,mp]);
 if(t.netWorth!==m.nw)bad.push(['netWorth',t.netWorth,m.nw]);
 for(const mo of ['2026-09','2026-10','2026-11','2026-12']){const r=report(l,mo),e=m.months[mo]||{income:0,spend:0};if(r.income!==e.income||r.spend!==e.spend)bad.push(['report '+mo,[r.income,r.spend],[e.income,e.spend]])}
 if(bad.length){out.mismatch.push({tag,bad})}
}
const SEQ=Number(process.argv[3]||400);const out={mismatch:[],decisions:0,accepted:0,rejected:0,disagree:[],editsOk:0,editsRej:0,delOk:0,delRej:0};
for(let s=0;s<SEQ;s++){
 let l=base();let ops=[];
 const count=ri(8,22);
 for(let i=0;i<count;i++){
  const o=gen();let app,appOk=true;
  try{app=prepareEntry(l,raw(o))}catch(e){appOk=false}
  const m=model([...ops,o],opening);
  out.decisions++;if(appOk!==m.ok)out.disagree.push({seq:s,kind:'add',op:o,app:appOk,model:m.ok});
  if(appOk&&m.ok){l=app;ops.push(o);out.accepted++}else out.rejected++;
 }
 compare('seq'+s+' after adds',l,ops,out);
 // random edits (amount or date) and deletions, compared accept/reject + resulting state
 for(let k=0;k<6&&ops.length;k++){
  const idx=ri(0,ops.length-1),o=ops[idx];
  if(rnd()<.5){ // delete
   let d=null,ok=true;try{d=deleteEntry(l,o.id)}catch(e){ok=false}
   const rest=ops.filter((_,i)=>i!==idx),m=model(rest,opening);out.decisions++;
   if(ok!==m.ok)out.disagree.push({seq:s,kind:'delete',op:o,app:ok,model:m.ok});
   if(ok&&m.ok){l=d;ops=rest;out.delOk++;compare('seq'+s+' after delete',l,ops,out)}else out.delRej++;
  }else{ // edit
   const edit=rnd()<.5?{amount:ri(1,400000)}:{date:pick(dates)};const o2={...o,...edit};
   if(edit.date&&o.month===o.date.slice(0,7))o2.month=edit.date.slice(0,7);
   if(o2.kind==='shared'&&edit.amount){const own=ri(0,edit.amount-1);o2.ownShare=own;o2.splits=[{person:'Ali',amount:edit.amount-own}]}
   const oldE=l.entries.find(e=>e.id===o.id);let e2=null,ok=true;try{e2=prepareEntry(l,{...raw(o2),effects:oldE.effects},oldE)}catch(e){ok=false}
   const next=ops.map((x,i)=>i===idx?o2:x),m=model(next,opening);out.decisions++;
   if(ok!==m.ok)out.disagree.push({seq:s,kind:'edit',op:o,edit,app:ok,model:m.ok});
   if(ok&&m.ok){l=e2;ops=next;out.editsOk++;compare('seq'+s+' after edit',l,ops,out)}else out.editsRej++;
  }
 }
}
console.log(JSON.stringify({seed:process.argv[2]||12345,sequences:SEQ,...out,mismatch:out.mismatch.length,disagree:out.disagree.length},null,1));
if(out.mismatch.length)console.log('FIRST MISMATCH',JSON.stringify(out.mismatch[0]).slice(0,1500));
if(out.disagree.length)console.log('FIRST DISAGREEMENT',JSON.stringify(out.disagree[0]).slice(0,1500));
