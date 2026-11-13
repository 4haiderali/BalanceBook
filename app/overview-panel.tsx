import type {ReactNode} from 'react';
import {ArrowDownLeft,ArrowUpRight} from 'lucide-react';
import {formatMoney as money,monthName} from '../lib/display-format';
import {KINDS,report,totals,type Ledger} from '../lib/ledger';
import {activeItems,itemName} from '../lib/ledger-items';
import type {Shortcut} from '../lib/shortcuts';

export function OverviewPanel({ledger,month,revision,recentActivity,navigate,onTransactions,useShortcut}:{
 ledger:Ledger;month:string;revision:number;recentActivity:ReactNode;
 navigate:(page:string)=>void;onTransactions:()=>void;useShortcut:(shortcut:Shortcut)=>void;
}){
 const stats=report(ledger,month),position=totals(ledger);
 const categories=Object.entries(stats.categories).sort((a,b)=>b[1]-a[1]).slice(0,5);
 const maxOverviewCategory=Math.max(1,...categories.map(([,value])=>Math.abs(value)));
 return <>
 {revision===1&&!ledger.entries.length&&<div className="info-box"><p>Starting with an empty ledger?</p><a className="button" href="/setup/">Import an existing backup</a></div>}
 <section className="month-hero" aria-label="Report month summary">
  <div className="month-hero-lead"><span className="month-hero-period">{monthName(month)} · Report month</span><h2>{stats.surplus<0?'Monthly deficit':'Monthly surplus'}</h2><div className="month-hero-amount"><span>PKR</span> {money(stats.surplus)}</div></div>
  <div className="month-hero-detail"><div className="month-hero-values">
   <div><span><ArrowDownLeft size={16}/> Income</span><strong>{money(stats.income)}</strong></div>
   <div><span><ArrowUpRight size={16}/> Net spending</span><strong>{money(stats.spend)}</strong></div>
  </div>{stats.income>0&&stats.spend>=0&&<div className="income-use"><div className="income-use-track" aria-hidden="true"><i className={stats.spend>stats.income?'over':''} style={{width:`${Math.min(100,stats.spend/stats.income*100)}%`}}/></div><span>{new Intl.NumberFormat('en-PK',{style:'percent',maximumFractionDigits:1}).format(stats.spend/stats.income)} of income spent</span></div>}
  {stats.refunds>0&&<small className="hero-refunds">Includes PKR {money(stats.refunds)} in refunds</small>}</div>
 </section>
 <div className="overview-columns">
  <section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Latest entries by actual date</p></div><button className="text-button" onClick={onTransactions}>All transactions <ArrowUpRight size={14}/></button></div>{recentActivity}</section>
  <div className="overview-balances">
   <section className="panel balance-overview"><div className="panel-heading"><div><h2>Tracked balances</h2><p>All recorded dates · PKR</p></div><button className="text-button" onClick={()=>navigate('accounts')}>Accounts</button></div><div className="balance-overview-total"><span>Tracked net worth</span><strong><small>PKR</small> {money(position.netWorth)}</strong></div><div className="dashboard-balances">{activeItems(ledger,'account').map(a=><div key={a}><span>{itemName(ledger,'account',a)}</span><strong>{money(position.accounts[a]||0)}</strong></div>)}</div></section>
   <section className="panel"><div className="panel-heading"><div><h2>People</h2><p>All recorded dates</p></div></div><div className="dashboard-balances"><button onClick={()=>navigate('people')}><span>People owe you</span><strong>PKR {money(position.receivable)}</strong></button><button onClick={()=>navigate('people')}><span>You owe people</span><strong>PKR {money(position.payable)}</strong></button><button onClick={()=>navigate('lunch')}><span>Group reimbursements due</span><strong>PKR {money(position.groupReceivable)}</strong></button></div></section>
  </div>
 </div>
 <section className="panel spending-panel">
  <div className="panel-heading"><div><h2>Category breakdown</h2><p>{monthName(month)} · Net spending</p></div><button className="text-button" onClick={()=>navigate('reports')}>Reports</button></div>
  {categories.length?<ul className="overview-category-list">{categories.map(([category,value])=><li key={category}>
   <span className="overview-category-name">{itemName(ledger,'category',category)}{value<0&&<small>Net refund</small>}</span>
   <span className="overview-category-track" aria-hidden="true"><i className={value<0?'refund':''} style={{width:`${Math.abs(value)/maxOverviewCategory*100}%`}}/></span>
   <strong className="overview-category-value">{value<0?'−':''}PKR {money(Math.abs(value))}</strong>
  </li>)}</ul>:<p className="empty">No spending this month.</p>}
 </section>
 <section className="panel overview-shortcuts">
  <div className="panel-heading"><h2>Shortcuts</h2><button className="text-button" onClick={()=>{navigate('shortcuts');window.scrollTo(0,0)}}>Manage shortcuts</button></div>
  {ledger.shortcuts?.length?<div className="overview-shortcut-list">{ledger.shortcuts.map(shortcut=><button className="overview-shortcut" key={shortcut.id} onClick={()=>useShortcut(shortcut)}>
   <span><strong>{shortcut.name}</strong><small>{KINDS[shortcut.kind]} · {itemName(ledger,'account',shortcut.account)}</small></span>
   <span className="shortcut-amount">{shortcut.amount?'PKR '+money(shortcut.amount):''}<ArrowUpRight size={15} aria-hidden="true"/></span>
  </button>)}</div>:<p className="overview-shortcut-empty">Save a transaction as a shortcut to reuse it here.</p>}
 </section>
 </>;
}
