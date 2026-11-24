import {delta,describeDelta,previousMonth} from '../lib/compare';
import {useEffect,useState,type ReactNode} from 'react';
import {ArrowDownLeft,ArrowUpRight} from 'lucide-react';
import {formatMoney as money,monthName,currencyAffix,currencyLabel,formatCurrency,formatDate} from '../lib/display-format';
import {KINDS,report,totals,type Ledger} from '../lib/ledger';
import {activeItems,itemName} from '../lib/ledger-items';
import {dueSoon,type Shortcut} from '../lib/shortcuts';
import {today} from '../lib/dates';
import {OverviewTrend} from './overview-trend';

const percentFormat=new Intl.NumberFormat('en-PK',{style:'percent',maximumFractionDigits:1});

function MonthComparison({current,previous,period,absolute=false}:{current:number;previous:number;period:string;absolute?:boolean}){
 const {amount,percent}=delta(current,previous);
 const value=absolute||percent===null?formatCurrency(Math.abs(amount)):percentFormat.format(Math.abs(percent)/100);
 const description=absolute&&amount!==0?value+(amount<0?' lower than ':' higher than ')+period:describeDelta(current,previous,period);
 return <p className="month-hero-comparison"><span className="sr-only">{description}</span><span aria-hidden="true">{amount===0?'Same as '+period:(amount<0?'↓ ':'↑ ')+value+' vs '+period}</span></p>;
}

export function OverviewPanel({ledger,month,revision,recentActivity,navigate,onTransactions,useShortcut}:{
 ledger:Ledger;month:string;revision:number;recentActivity:ReactNode;
 navigate:(page:string)=>void;onTransactions:()=>void;useShortcut:(shortcut:Shortcut)=>void;
}){
 const [currentDate,setCurrentDate]=useState(today);
 useEffect(()=>{
  const refreshDate=()=>setCurrentDate(today());
  const interval=window.setInterval(refreshDate,15_000);
  window.addEventListener('focus',refreshDate);
  return ()=>{
   window.clearInterval(interval);
   window.removeEventListener('focus',refreshDate);
  };
 },[]);
 const upcoming=dueSoon(ledger.shortcuts??[],currentDate,0);
 const currentDay=Date.parse(currentDate+'T00:00:00Z');
 const stats=report(ledger,month),position=totals(ledger);
 const priorMonth=previousMonth(month);
 const priorLabel=priorMonth.slice(0,4)===month.slice(0,4)?monthName(priorMonth).split(' ')[0]:monthName(priorMonth);
 const priorStats=report(ledger,priorMonth);
 const priorEntries=ledger.entries.filter(entry=>!entry.deleted&&entry.month===priorMonth);
 const hasPriorSurplus=priorEntries.some(entry=>entry.effects.income!==0||entry.effects.spend!==0);
 const accounts=Object.values(position.accounts).reduce((sum,balance)=>sum+balance,0);
 const other=position.netWorth-(accounts+position.receivable-position.payable+position.groupReceivable);
 const breakdown=[
  {label:'Accounts',amount:accounts},
  {label:'People owe you',amount:position.receivable},
  {label:'You owe people',amount:position.payable},
  {label:'Group due',amount:position.groupReceivable},
  {label:'Other',amount:other},
 ].filter(({amount})=>amount!==0);
 const currency=currencyLabel();
 const cardAmount=(amount:number)=><strong className="month-hero-amount">{currency&&<small>{currency}</small>}<span>{money(amount)}</span></strong>;
 const categories=Object.entries(stats.categories).sort((a,b)=>b[1]-a[1]).slice(0,5);
 const shareFormat=new Intl.NumberFormat('en-PK',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1});
 return <>
 {revision===1&&!ledger.entries.length&&<div className="info-box"><p>Starting with an empty ledger?</p><a className="button" href="/setup/">Import an existing backup</a></div>}
 <section className="month-hero" aria-label="Report month summary">
  <span className="month-hero-period">{monthName(month)} · Report month</span>
  <div className="month-hero-cards">
   <div className="month-hero-card month-hero-income"><h2><ArrowDownLeft size={16} aria-hidden="true"/> Income</h2>{cardAmount(stats.income)}<div className="month-hero-support">
    {priorEntries.some(entry=>entry.effects.income!==0)&&<MonthComparison current={stats.income} previous={priorStats.income} period={priorLabel}/>}</div>
   </div>
   <div className="month-hero-card month-hero-spending">
    <h2><ArrowUpRight size={16} aria-hidden="true"/> Net spending</h2>{cardAmount(stats.spend)}<div className="month-hero-support">
    {priorEntries.some(entry=>entry.effects.spend!==0)&&<MonthComparison current={stats.spend} previous={priorStats.spend} period={priorLabel}/>}
    {stats.income>0&&stats.spend>=0&&<div className="income-use"><div className="income-use-track" aria-hidden="true"><i className={stats.spend>stats.income?'over':''} style={{width:`${Math.min(100,stats.spend/stats.income*100)}%`}}/></div><span>{percentFormat.format(stats.spend/stats.income)} of income spent</span></div>}
    {stats.refunds>0&&<small className="hero-refunds">Includes {formatCurrency(stats.refunds)} in refunds</small>}</div>
   </div>
   <div className="month-hero-card month-hero-surplus"><h2>{stats.surplus<0?'Deficit':'Surplus'}</h2>{cardAmount(stats.surplus)}<div className="month-hero-support">
    {hasPriorSurplus&&<MonthComparison current={stats.surplus} previous={priorStats.surplus} period={priorLabel} absolute/>}</div>
   </div>
   <div className="month-hero-card">
    <div className="month-hero-heading"><h2>Tracked net worth</h2><small>All dates</small></div>{cardAmount(position.netWorth)}
    {breakdown.length>0&&<dl className="month-hero-breakdown">{breakdown.map(({label,amount})=><div key={label}><dt>{label}</dt><dd>{money(amount)}</dd></div>)}</dl>}
   </div>
  </div>
 </section>
 {upcoming.length>0&&<section className="panel overview-due" aria-labelledby="overview-due-title">
  <div className="panel-heading"><h2 id="overview-due-title">Due and overdue</h2></div>
  <div className="overview-due-list">{upcoming.map(shortcut=>{
   const days=(Date.parse(shortcut.nextDue+'T00:00:00Z')-currentDay)/86_400_000;
   const distance=Math.abs(days);
   const dayCount=distance===1?'1 day':distance+' days';
   const hint=days<0?dayCount+' overdue':'Due today';
   return <button type="button" className={'overview-due-row'+(days<0?' is-overdue':'')} key={shortcut.id} onClick={()=>useShortcut(shortcut)}>
    <span className="overview-due-label"><strong>{shortcut.name}</strong><time dateTime={shortcut.nextDue} title={formatDate(shortcut.nextDue)}>{hint}</time></span>
    <span className="shortcut-amount">{formatCurrency(shortcut.amount)}<ArrowUpRight size={15} aria-hidden="true"/></span>
   </button>;
  })}</div>
 </section>}
 <OverviewTrend ledger={ledger} month={month}/>
 <div className="overview-columns">
  <section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Latest entries by actual date</p></div><button className="text-button" onClick={onTransactions}>All transactions <ArrowUpRight size={14}/></button></div>{recentActivity}</section>
  <div className="overview-balances">
   <section className="panel balance-overview"><div className="panel-heading"><div><h2>Tracked balances</h2><p>All recorded dates{currencyAffix(' · ')}</p></div><button className="text-button" onClick={()=>navigate('accounts')}>Accounts</button></div><div className="dashboard-balances">{activeItems(ledger,'account').map(a=><div key={a}><span>{itemName(ledger,'account',a)}</span><strong>{money(position.accounts[a]||0)}</strong></div>)}</div></section>
   <section className="panel"><div className="panel-heading"><div><h2>People</h2><p>All recorded dates</p></div></div><div className="dashboard-balances"><button onClick={()=>navigate('people')}><span>People owe you</span><strong>{formatCurrency(position.receivable)}</strong></button><button onClick={()=>navigate('people')}><span>You owe people</span><strong>{formatCurrency(position.payable)}</strong></button><button onClick={()=>navigate('lunch')}><span>Group reimbursements due</span><strong>{formatCurrency(position.groupReceivable)}</strong></button></div></section>
  </div>
 </div>
 <section className="panel spending-panel">
  <div className="panel-heading"><div><h2>Category breakdown</h2><p>{monthName(month)} · Net spending</p></div><button className="text-button" onClick={()=>navigate('reports')}>Reports</button></div>
  {categories.length?<ul className="overview-category-list">{categories.map(([category,value])=><li key={category}>
   <span className="overview-category-name">{itemName(ledger,'category',category)}{value<0&&<small>Net refund</small>}</span>
   <span className="overview-category-track" aria-hidden="true"><i className={value<0?'refund':''} style={{width:`${stats.spend?Math.min(100,Math.abs(value/stats.spend)*100):0}%`}}/></span>
   <strong className="overview-category-value">{value<0?'−':''}{formatCurrency(Math.abs(value))}<small>{shareFormat.format(stats.spend?value/stats.spend:0)}</small></strong>
  </li>)}</ul>:<p className="empty">No spending this month.</p>}
 </section>
 <section className="panel overview-shortcuts">
  <div className="panel-heading"><h2>Shortcuts</h2><button className="text-button" onClick={()=>{navigate('shortcuts');window.scrollTo(0,0)}}>Manage shortcuts</button></div>
  {ledger.shortcuts?.length?<div className="overview-shortcut-list">{ledger.shortcuts.map(shortcut=><button className="overview-shortcut" key={shortcut.id} onClick={()=>useShortcut(shortcut)}>
   <span><strong>{shortcut.name}</strong><small>{KINDS[shortcut.kind]} · {itemName(ledger,'account',shortcut.account)}</small></span>
   <span className="shortcut-amount">{shortcut.amount?formatCurrency(shortcut.amount):''}<ArrowUpRight size={15} aria-hidden="true"/></span>
  </button>)}</div>:<p className="overview-shortcut-empty">Save a transaction as a shortcut to reuse it here.</p>}
 </section>
 </>;
}
