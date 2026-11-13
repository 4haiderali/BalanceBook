import {totals,type Ledger} from '../lib/ledger';
import {formatExactMoney} from '../lib/display-format';

export function PersonSelect({ledger,value,onChange,required,retained=''}:{
 ledger:Ledger;value:string;onChange:(key:string)=>void;required?:boolean;retained?:string;
}){
 const people=(ledger.people||[]).filter(p=>p.key===retained||(!p.archived&&!p.notPerson&&!p.mergedInto))
  .sort((a,b)=>a.name.localeCompare(b.name));
 const {people:balances}=totals(ledger);
 return <select required={required} value={value} onChange={event=>onChange(event.target.value)}>
  <option value="">{required?'Choose a person':'No person'}</option>
  {people.map(p=><option key={p.id} value={p.key}>{p.name}{balances[p.key]?.receivable>0?' · owes you PKR '+formatExactMoney(balances[p.key].receivable):''}{balances[p.key]?.payable>0?' · you owe PKR '+formatExactMoney(balances[p.key].payable):''}</option>)}
 </select>;
}
