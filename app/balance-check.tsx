import {formatExactMoney} from '../lib/display-format';
import {useState} from 'react';
import {X} from 'lucide-react';
import {totals,type Ledger} from '../lib/ledger';
import {itemName} from '../lib/ledger-items';
import {parseAmount} from '../lib/money-input';
import {addCheckpoint,validDate} from '../lib/review';

const money=(cents:number)=>'PKR '+formatExactMoney(cents);

export function BalanceCheck({ledger,account,today,saving,saveError,onClose,onSave,onTransactions}:{
 ledger:Ledger;account:string;today:string;saving:boolean;saveError:string;
 onClose:()=>void;onSave:(next:Ledger,reason:string)=>Promise<boolean>;onTransactions:(date:string)=>void;
}){
 const [date,setDate]=useState(today),[actual,setActual]=useState(''),[error,setError]=useState('');
 const valid=validDate(date)&&date>=ledger.baselineDate&&date<=today;
 const calculated=valid?totals(ledger,date).accounts[account]||0:null;
 let entered:number|undefined;
 try{entered=parseAmount(actual,true)}catch{}
 const difference=calculated===null||entered===undefined?null:entered-calculated;
 const name=itemName(ledger,'account',account);
 return <div className="modal-overlay entry-overlay"><section className="modal balance-check-dialog" role="dialog" aria-modal="true" aria-labelledby="balance-check-title">
  <div className="modal-heading"><h2 id="balance-check-title">Confirm balance · {name}</h2><button className="account-editor-close" aria-label="Close balance check" disabled={saving} onClick={onClose}><X size={21}/></button></div>
  <form onSubmit={async event=>{
   event.preventDefault();setError('');
   try{
    if(!valid)throw Error('Choose a closing date from the ledger start through today.');
    const next=addCheckpoint(ledger,account,date,parseAmount(actual,true));
    if(await onSave(next,'Balance checkpoint saved: '+name))onClose();
   }catch(err){setError(err instanceof Error?err.message:'Could not save the checkpoint.');}
  }}>
   <label>Closing date<input required type="date" min={ledger.baselineDate} max={today} value={date} onChange={e=>setDate(e.target.value)}/></label>
   <label>Statement closing balance · PKR<input autoFocus required inputMode="decimal" value={actual} onChange={e=>setActual(e.target.value)}/></label>
   {calculated!==null&&<p>BalanceBook closing balance <strong>{money(calculated)}</strong></p>}
   {difference!==null&&<div className={difference?'form-error':'info-box'} role="status">{difference?'Statement minus BalanceBook: '+(difference>0?'+':'')+money(difference):'Balances match.'}</div>}
   <p>Saving a checkpoint records the comparison without changing the balance.</p>
   {(error||saveError)&&<p className="form-error" role="alert">{error||saveError}</p>}
   <div className="modal-footer"><button type="button" className="button" disabled={!valid||saving} onClick={()=>onTransactions(date)}>View transactions</button><button className="button primary" disabled={saving}>Save checkpoint</button></div>
  </form>
 </section></div>;
}
