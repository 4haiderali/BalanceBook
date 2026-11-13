import type {Ledger} from './ledger';
import {appendAudit,checkTransition} from './v2';
export async function prepareWrite(previous:Ledger,payload:{data?:Ledger;reason?:string;operation?:string;restoreRevision?:number},lookupSnapshot:(revision:number)=>Promise<Ledger|null>){
 const operation=payload.operation||'save';let data:Ledger,reason=String(payload.reason??'').trim();
 if(operation==='restore'){
  if(!Number.isSafeInteger(payload.restoreRevision)||payload.restoreRevision!<1)throw Error('Select a valid saved version.');
  const snapshot=await lookupSnapshot(payload.restoreRevision!);if(!snapshot)throw Error('Saved version not found.');
  data=snapshot;reason='Restored saved version '+payload.restoreRevision;
 }else if(operation==='save'||operation==='import'){
  if(!payload.data)throw Error('Missing ledger data.');data=payload.data;
 }else throw Error('Unknown save operation.');
 const checked=checkTransition(previous,data,reason,operation==='save'?'edit':'replacement');
 return {data:appendAudit(previous,checked,reason),reason};
}
