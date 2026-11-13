import {formatMoney} from '../lib/display-format';
import {ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Minus} from 'lucide-react';
import {KINDS, type Entry, type Ledger} from '../lib/ledger';
import {itemName} from '../lib/ledger-items';
import {personName} from '../lib/v2';

const date = new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});

function appearance(entry:Entry){
 const {effects}=entry;
 const movement=Object.values(effects.accounts).reduce((sum,value)=>sum+value,0);
 const transfer=entry.kind==='transfer'||['Saving','Savings Withdrawal','Cash Withdrawal','Cash Deposit','Internal Transfer'].includes(entry.legacyType||'');
 const debt=Object.values(effects.receivable).some(Boolean)||Object.values(effects.payable).some(Boolean);
 const tone=entry.deleted?'neutral':transfer?'transfer':entry.kind.startsWith('group')?'group':debt?'loan':effects.income>0||effects.spend<0?'green':effects.spend>0?'expense':'neutral';
 const Icon=transfer?ArrowLeftRight:movement>0?ArrowDownLeft:movement<0?ArrowUpRight:Minus;
 return {tone,Icon,transfer,kind:entry.legacyType||KINDS[entry.kind]||entry.kind};
}

export function TransactionCells({entry,ledger,onOpen,displayAmount=entry.amount,context}:{
 entry:Entry;ledger:Ledger;onOpen:()=>void;displayAmount?:number;context?:string;
}){
 const {tone,Icon,transfer,kind}=appearance(entry);
 const incomingAccounts=transfer&&!entry.to?Object.entries(entry.effects.accounts).filter(([,value])=>value>0):[];
 const destination=transfer?(entry.to||(incomingAccounts.length===1?incomingAccounts[0][0]:'')):'';
 const destinationLabel=destination?' · to '+itemName(ledger,'account',destination):'';
 const person=personName(ledger,entry.person);
 const category=itemName(ledger,'category',entry.category)||'—';
 const actualDate=new Date(entry.date+'T00:00:00Z');
 return <>
  <td><button className="transaction-name transaction-open" onClick={onOpen} aria-label={'Open transaction: '+entry.description+destinationLabel}>
   <span className={'tx-icon '+tone}><Icon size={15} aria-hidden="true"/></span>
   <div><strong>{entry.description}</strong>
    <small className="transaction-caption"><span className={'transaction-type '+tone}>{entry.deleted?'Deleted':kind}</span>{entry.kind==='legacy'?' · Excel':''}{destinationLabel}{person?' · '+person:''}</small>
    {context&&<small>{context}</small>}
   </div>
  </button></td>
  <td className="transaction-category">{category}</td>
  <td>{itemName(ledger,'account',entry.account)||'No bank movement'}</td>
  <td className="nowrap">{Number.isNaN(actualDate.getTime())?entry.date:date.format(actualDate)}</td>
  <td className={'right amount '+(tone==='green'?'positive':'')}>{formatMoney(displayAmount)}</td>
 </>;
}

export function TransactionHeadings({actions=false}:{actions?:boolean}){
 return <thead><tr><th scope="col">Transaction</th><th scope="col">Category</th><th scope="col">Account</th><th scope="col">Actual date</th><th scope="col" className="right">Amount (PKR)</th>{actions&&<th scope="col">Actions</th>}</tr></thead>;
}
