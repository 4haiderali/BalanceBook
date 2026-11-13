import {useState} from 'react';
import {accountType,type AccountType} from '../lib/accounts';
import {itemHasHistory,itemName,itemStatus,manageLedgerItem,type ItemKind} from '../lib/ledger-items';
import type {Ledger} from '../lib/ledger';

const ACCOUNT_TYPES:AccountType[]=['current','savings','wallet','cash'];
export function AccountTypeOptions(){
 return <>{ACCOUNT_TYPES.map(type=><option key={type} value={type}>{type[0].toUpperCase()+type.slice(1)}</option>)}</>;
}

export function LedgerItemActions({ledger,kind,itemKey,onSave,balance=0}:{
 ledger:Ledger;kind:ItemKind;itemKey:string;onSave:(ledger:Ledger,reason:string)=>Promise<boolean>;balance?:number;
}){
 const label=itemName(ledger,kind,itemKey),archived=itemStatus(ledger,kind,itemKey)==='archived';
 const account=kind==='account';
 const [editing,setEditing]=useState(false),[name,setName]=useState(label),[type,setType]=useState(()=>accountType(ledger,itemKey)),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const unchanged=account&&name===label&&type===accountType(ledger,itemKey);
 async function apply(action:Parameters<typeof manageLedgerItem>[3]){
  setError('');
  setBusy(true);
  try{
   let changed=action==='rename'&&account&&name===label?ledger:manageLedgerItem(ledger,kind,itemKey,action,name);
   if(account&&action==='rename'&&type!==accountType(ledger,itemKey))
    changed={...changed,accountTypes:{...changed.accountTypes,[itemKey]:type}};
   const reason=account&&action==='rename'?'Account updated: '+label:action+' '+kind+': '+label;
   if(await onSave(changed,reason))setEditing(false);
  }catch(error){setError(error instanceof Error?error.message:'Could not update '+kind+'.');}
  finally{setBusy(false);}
 }
 return <div className={'ledger-item-actions'+(account?' account-settings-fields':'')}>
  {(account||editing)&&<form onSubmit={event=>{event.preventDefault();void apply('rename')}}>
   <label>{account?'Account name':'Category name'}<input autoFocus={account} required maxLength={60} value={name} onChange={event=>setName(event.target.value)}/></label>
   {account&&<label>Account type<select value={type} onChange={event=>setType(event.target.value as AccountType)}><AccountTypeOptions/></select></label>}
   <button className="button primary" disabled={busy||unchanged}>{account?'Save changes':'Save name'}</button>
   {!account&&<button className="button" type="button" disabled={busy} onClick={()=>{setEditing(false);setError('')}}>Cancel</button>}
  </form>}
  {(account||!editing)&&<div className="button-row">
   {!account&&<button className="button" disabled={busy} onClick={()=>{setName(label);setError('');setEditing(true)}}>Rename</button>}
   <button className="button" disabled={busy||(!archived&&!!balance)} title={balance?'Settle this account before archiving':undefined} onClick={()=>void apply(archived?'restore':'archive')}>{archived?'Restore':'Archive'}</button>
   {!itemHasHistory(ledger,kind,itemKey)&&<button className="button" disabled={busy} onClick={()=>{if(window.confirm('Delete '+label+'?'))void apply('delete')}}>Delete</button>}
  </div>}
  {error&&<p className="form-error" role="alert">{error}</p>}
 </div>;
}
