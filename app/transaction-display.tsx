import {formatMoney,formatDate,currencyAffix} from '../lib/display-format';
import {ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ArrowDown, ArrowUp, ArrowUpDown, Minus} from 'lucide-react';
import {KINDS, type Entry, type Ledger} from '../lib/ledger';
import {itemName} from '../lib/ledger-items';
import {personName} from '../lib/v2';


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
 const category=transfer?'—':itemName(ledger,'category',entry.category)||'—';
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
  <td className="nowrap">{formatDate(entry.date)}</td>
  <td className={'right amount '+(tone==='green'?'positive':'')}>{formatMoney(displayAmount)}</td>
 </>;
}

const transactionColumns=[
 ['description','Transaction'],['category','Category'],['account','Account'],
 ['date','Actual date'],['amount','Amount'],
] as const;
export type TransactionColumn=typeof transactionColumns[number][0];
export type TransactionSort={column:TransactionColumn;direction:'ascending'|'descending'};

export function orderTransactions(entries:Entry[],ledger:Ledger,sort:TransactionSort|null){
 if(!sort)return entries;
 const {column,direction}=sort;
 const value=(entry:Entry)=>{
  if(column==='category')return appearance(entry).transfer?'\u2014':itemName(ledger,'category',entry.category)||'\u2014';
  if(column==='account')return itemName(ledger,'account',entry.account)||'No bank movement';
  return entry[column];
 };
 const collator=new Intl.Collator(undefined,{sensitivity:'base',numeric:true});
 return [...entries].sort((left,right)=>{
  const a=value(left),b=value(right);
  const comparison=typeof a==='number'&&typeof b==='number'?a-b:collator.compare(String(a),String(b));
  return direction==='ascending'?comparison:-comparison;
 });
}

export function TransactionHeadings({actions=false,sort,onSort}:{
 actions?:boolean;sort?:TransactionSort|null;onSort?:(column:TransactionColumn)=>void;
}){
 return <thead><tr>{transactionColumns.map(([column,label])=>{
  const title=label+(column==='amount'?currencyAffix(' (',')'):'');
  const direction=sort?.column===column?sort.direction:undefined;
  const Icon=direction==='ascending'?ArrowUp:direction==='descending'?ArrowDown:ArrowUpDown;
  return <th key={column} scope="col" aria-sort={direction} className={column==='amount'?'right':undefined}>
   {onSort?<button type="button" className="transaction-sort" onClick={()=>onSort(column)}>{title}<Icon size={13} aria-hidden="true"/></button>:title}
  </th>;
 })}{actions&&<th scope="col">Actions</th>}</tr></thead>;
}
