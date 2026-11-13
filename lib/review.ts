import {accountNames} from './accounts';
import {ACCOUNTS,totals,reflow,emptyEffects,type Ledger,type Entry} from './ledger.ts';
export const REVIEW_FROM='2026-08-01';
export const inReviewFocus=(e:Pick<Entry,'date'>)=>e.date>=REVIEW_FROM;
export type Checkpoint={id:string;account:string;date:string;actual:number;capturedCalculated:number;initialDifference:number;status:'open'|'explained'|'adjusted';reason:string;adjustmentId?:string;source?:string};
export type ReviewItem={id:string;title:string;entryIds:string[];classification:'unreviewed'|'estimate'|'unexplained'|'verified';state:'open'|'explained';reason:string};
export type FoodCheck={id:string;from:string;to:string;state:'pending'|'recorded'|'notApplicable';entryIds:string[];reason:string};
export type ReviewData={checkpoints:Checkpoint[];items:ReviewItem[];food:FoodCheck[];duplicateAcknowledgements:string[];backup?:{at:string;auditCount:number}};
export const reviewData=(l:Ledger):ReviewData=>l.review||{checkpoints:[],items:[],food:[],duplicateAcknowledgements:[]};
export function updateReview(l:Ledger,patch:Partial<ReviewData>):Ledger{return {...l,review:{...reviewData(l),...patch}}}
export function validDate(d:string){return /^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d}
export function checkpointView(l:Ledger,c:Checkpoint){const calculated=totals(l,c.date).accounts[c.account]||0;return {calculated,difference:c.actual-calculated,needsRecheck:calculated!==c.capturedCalculated,status:calculated!==c.capturedCalculated?'Needs recheck':c.status==='open'&&c.actual===calculated?'Matched':c.status}}
export function addCheckpoint(l:Ledger,account:string,date:string,actual:number,source=''):Ledger{
 if(!accountNames(l).includes(account)||!validDate(date)||date<l.baselineDate||!Number.isSafeInteger(actual))throw Error('Choose an account, valid date and exact balance.');
 const calculated=totals(l,date).accounts[account]||0;const c:Checkpoint={id:crypto.randomUUID(),account,date,actual,capturedCalculated:calculated,initialDifference:actual-calculated,status:'open',reason:'',source};
 return updateReview(l,{checkpoints:[...reviewData(l).checkpoints,c]});
}
export function resolveCheckpoint(l:Ledger,id:string,action:'explain'|'adjust'|'recheck',reason:string):Ledger{
 const c=reviewData(l).checkpoints.find(x=>x.id===id);if(!c)throw Error('Checkpoint not found.');if(!reason.trim())throw Error('Add a reason.');
 const view=checkpointView(l,c);let next=l,adjustmentId=c.adjustmentId;
 if(action==='adjust'&&view.difference){adjustmentId=crypto.randomUUID();const e:Entry={id:adjustmentId,date:c.date,month:c.date.slice(0,7),description:'Checkpoint adjustment · '+c.account,kind:'adjustment',category:'',amount:Math.abs(view.difference),account:c.account,person:'',notes:reason,to:view.difference<0?'subtract':'add',checkpointId:id,effects:emptyEffects()};next=reflow({...l,entries:[...l.entries,e]})}
 const calculated=totals(next,c.date).accounts[c.account]||0;
 return updateReview(next,{checkpoints:reviewData(l).checkpoints.map(x=>x.id===id?{...x,status:action==='adjust'?'adjusted':action==='explain'?'explained':'open',capturedCalculated:calculated,reason,adjustmentId}:x)});
}
// The split is a transfer only. Any mismatch remains visibly in Legacy Current.
export function splitCurrent(l:Ledger,date:string,alfalah:number,nayapay:number):Ledger{
 if(!validDate(date)||date<l.baselineDate||![alfalah,nayapay].every(Number.isSafeInteger))throw Error('Enter a cutoff date and exact balances.');
 const balances=totals(l,date).accounts;const entries=[...l.entries];for(const [account,target] of [['Alfalah',alfalah],['NayaPay',nayapay]] as const){const delta=target-(balances[account]||0);if(!delta)continue;entries.push({id:crypto.randomUUID(),kind:'transfer',date,month:date.slice(0,7),description:'Verified Current split · '+account,amount:Math.abs(delta),account:delta>0?'Legacy Current':account,to:delta>0?account:'Legacy Current',category:'',person:'',notes:'Verified balances at one cutoff; residual remains in Legacy Current.',effects:emptyEffects()})}
 let n=reflow({...l,entries});n=addCheckpoint(n,'Alfalah',date,alfalah,'Verified Current split');n=addCheckpoint(n,'NayaPay',date,nayapay,'Verified Current split');return addCheckpoint(n,'Legacy Current',date,0,'Unallocated residual after verified split');
}
export function splitwiseTiming(l:Ledger,period:string){let funded=0,food=0;for(const e of l.entries){if(e.deleted||!e.month.startsWith(period))continue;if(e.kind==='groupPayment')funded+=e.group?.selfFunded||0;if(e.kind==='splitwiseFunding')funded+=e.amount;if(e.kind==='weeklyShare'||e.kind==='splitwiseShare')food+=e.effects.spend}return {funded,food,difference:funded-food}}
export function foodCoverage(l:Ledger,c:FoodCheck){if(c.state==='notApplicable')return {covered:true,label:'Not applicable'};const linked=c.entryIds.map(id=>l.entries.find(e=>e.id===id&&!e.deleted&&e.category==='Food'&&e.effects.spend>0)).filter(Boolean) as Entry[];const ranges=l.entries.filter(e=>!e.deleted&&e.kind==='weeklyShare'&&e.foodRange).map(e=>e.foodRange!).sort((a,b)=>a.from.localeCompare(b.from));let cursor=c.from;for(const r of ranges){if(r.to<cursor)continue;if(r.from>cursor)break;if(r.to>=c.to)return {covered:true,label:'Covered by recorded Food shares'};cursor=new Date(Date.parse(r.to)+86400000).toISOString().slice(0,10)}return {covered:c.state==='recorded'&&linked.length===c.entryIds.length&&linked.length>0,label:c.state==='recorded'?'Check linked Food entries':'Pending'}}
function signature(e:Entry){return JSON.stringify([e.id,e.date,e.amount,e.kind,e.category,e.person,e.foodRange||null,Object.entries(e.effects.accounts).sort()])}
export function duplicatePairs(l:Ledger,changedIds?:Set<string>){
 const result:{key:string;a:Entry;b:Entry;reason:string}[]=[];
 const entries=l.entries.filter(e=>!e.deleted&&inReviewFocus(e));
 const indexes=entries.map((_,i)=>i);
 const changed=indexes.filter(i=>changedIds?.has(entries[i].id));
 const acknowledged=new Set(reviewData(l).duplicateAcknowledgements);
 for(let i=0;i<entries.length;i++){
  const a=entries[i];
  const candidates=!changedIds||changedIds.has(a.id)?indexes:changed;
  for(const j of candidates){
   if(j<=i)continue;
   const b=entries[j];
 const food=a.category==='Food'&&b.category==='Food'&&a.effects.spend>0&&b.effects.spend>0;
 const overlap=food&&a.foodRange&&b.foodRange&&a.foodRange.from<=b.foodRange.to&&b.foodRange.from<=a.foodRange.to;
 const close=Math.abs(Date.parse(a.date)-Date.parse(b.date))<=2*86400000;
 const bank=close&&Object.entries(a.effects.accounts).some(([account,n])=>n!==0&&b.effects.accounts[account]===n);
 const noncash=close&&food&&!Object.values(a.effects.accounts).some(Boolean)&&!Object.values(b.effects.accounts).some(Boolean)&&a.effects.spend===b.effects.spend&&a.person===b.person;
 if(!overlap&&!bank&&!noncash)continue;
 const key=[signature(a),signature(b)].sort().join('::');if(!acknowledged.has(key))result.push({key,a,b,reason:overlap?'Food coverage dates overlap':noncash?'Same non-cash Food share near the same date':'Same account and amount near the same date'})}}return result.sort((a,b)=>Number(b.reason.includes('overlap'))-Number(a.reason.includes('overlap')))}
export function reviewSuggestions(l:Ledger){const existing=new Set(reviewData(l).items.flatMap(i=>i.entryIds));return l.entries.filter(e=>!e.deleted&&inReviewFocus(e)&&!existing.has(e.id)&&/rough|estimat|plug|unexplained|adjust|remember|misc/i.test(e.description+' '+e.notes)).sort((a,b)=>b.date.localeCompare(a.date))}
// Preserve existing review metadata; never inject personal workbook checkpoints.
export function withHistoricalReview(l:Ledger):Ledger{return l}
export function validateReview(l:Ledger){const r=l.review;if(!r)return;for(const k of ['checkpoints','items','food','duplicateAcknowledgements'] as const)if(!Array.isArray(r[k]))throw Error('Invalid review metadata.');const ids=new Set<string>();for(const c of r.checkpoints){if(!c.id||ids.has(c.id)||!accountNames(l).includes(c.account)||!validDate(c.date)||c.date<l.baselineDate||![c.actual,c.capturedCalculated,c.initialDifference].every(Number.isSafeInteger)||!['open','explained','adjusted'].includes(c.status)||typeof c.reason!=='string')throw Error('Invalid checkpoint.');ids.add(c.id);if(c.status!=='open'&&!c.reason.trim())throw Error('Resolved checkpoints need an explanation.');if(c.adjustmentId){const e=l.entries.find(e=>e.id===c.adjustmentId);if(!e||e.kind!=='adjustment'||e.checkpointId!==c.id||e.account!==c.account||e.date!==c.date)throw Error('Invalid checkpoint adjustment link.')}}for(const i of r.items)if(!i.id||!Array.isArray(i.entryIds)||!i.entryIds.every(id=>l.entries.some(e=>e.id===id))||!['unreviewed','estimate','unexplained','verified'].includes(i.classification)||!['open','explained'].includes(i.state)||typeof i.reason!=='string'||i.state==='explained'&&!i.reason.trim())throw Error('Invalid review item.');for(const f of r.food)if(!f.id||!validDate(f.from)||!validDate(f.to)||f.from>f.to||!Array.isArray(f.entryIds)||!['pending','recorded','notApplicable'].includes(f.state)||typeof f.reason!=='string')throw Error('Invalid Food checklist.');if(r.duplicateAcknowledgements.some(x=>typeof x!=='string'))throw Error('Invalid duplicate acknowledgement.');if(r.backup&&(!Number.isSafeInteger(r.backup.auditCount)||r.backup.auditCount<0||!Number.isFinite(Date.parse(r.backup.at))))throw Error('Invalid backup marker.')}
