'use client';
import {formatMoney as money,formatDate,currencyAffix,formatCurrency,monthName} from '../lib/display-format';
import {describeDelta,previousMonth} from '../lib/compare';
import {useState} from 'react';
import {Popover,PopoverContent,PopoverTrigger} from '../components/ui/popover';
import {sortCategoryCards,type CategorySort} from '../lib/account-category-display';
import {Tag,ArrowUpRight,ShoppingBag,Users,Undo2,HandCoins,X,Search,ArrowDownLeft,UtensilsCrossed,ShoppingBasket,House,CarFront,Fuel,HeartPulse,UserRound,HeartHandshake,Gift,Receipt,Wallet,GraduationCap,Plane,Gamepad2,PawPrint,BriefcaseBusiness,PiggyBank,type LucideIcon} from 'lucide-react';
import {itemName,itemStatus} from '../lib/ledger-items';
import {LedgerItemActions} from './ledger-item-actions';
import {CATEGORY_ICONS,categoryNames,categoryType,addCategory,categoryIcon,setCategoryIcon,type CategoryIcon} from '../lib/categories';
import {report,type Entry,type Ledger} from '../lib/ledger';
function summary(entries:Entry[]){return entries.reduce((s,e)=>({spend:s.spend+e.effects.spend,income:s.income+e.effects.income,refunds:s.refunds+Math.max(0,-e.effects.spend),count:s.count+1}),{spend:0,income:0,refunds:0,count:0})}
const ACTIONS=[{kind:'expense',title:'I paid for a purchase',text:'Record your own expense from the account you used.',Icon:ShoppingBag},{kind:'shared',title:'I paid for a shared purchase',text:'Split the total into your share and what others owe you.',Icon:Users},{kind:'personExpense',title:'Someone paid for me',text:'Record your share and update your balance with that person.',Icon:HandCoins},{kind:'merchantRefund',title:'Refund this purchase',text:'Link money returned to a purchase, capped at your own expense.',Icon:Undo2},{kind:'officeRecovery',title:'Office reimbursed me',text:'Reduce your expense, including reimbursements covering several purchases.',Icon:HandCoins}];
const GUIDE_KEY='balancebook-category-guide-dismissed';
function guideDismissed(){
 try{if(document.cookie.split('; ').includes(GUIDE_KEY+'=1'))return true}catch{}
 try{return window.localStorage.getItem(GUIDE_KEY)==='1'}catch{return false}
}

export function CategoryPanel({ledger,month,onAction,onView,onViewAll,onSave}:{ledger:Ledger;onViewAll:(category:string)=>void;month:string;onAction:(category:string,kind:string,title:string)=>void;onView:(e:Entry)=>void;onSave:(l:Ledger,reason:string)=>Promise<boolean>}){
 const [newName,setNewName]=useState(''),[newType,setNewType]=useState<'expense'|'income'>('expense'),[adding,setAdding]=useState(false),[error,setError]=useState('');
 const [newIcon,setNewIcon]=useState<CategoryIcon>('tag');
 const [editIcon,setEditIcon]=useState<CategoryIcon>('tag'),[savingIcon,setSavingIcon]=useState(false),[editingIcon,setEditingIcon]=useState(false);
 const [showArchived,setShowArchived]=useState(false);
 const [hideGuide,setHideGuide]=useState(guideDismissed);
 const [sort,setSort]=useState<CategorySort>('spending');
 const monthSpend=report(ledger,month).spend;
 const percent=new Intl.NumberFormat('en-PK',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1});
 function dismissGuide(){
  setHideGuide(true);
  try{document.cookie=GUIDE_KEY+'=1; Max-Age=31536000; Path=/; SameSite=Lax'}catch{}
  try{window.localStorage.setItem(GUIDE_KEY,'1')}catch{}
 }
 const [selected,setSelected]=useState<string|null>(null),[query,setQuery]=useState('');
 const active=ledger.entries.filter(e=>!e.deleted).flatMap(e=>e.effects.spendByCategory?Object.entries(e.effects.spendByCategory).map(([category,spend])=>({...e,category,effects:{...e.effects,spend}})):[e]),categories=categoryNames(ledger).filter(c=>itemStatus(ledger,'category',c)===(showArchived?'archived':'active'));
 const matchesCategory=(key:string)=>itemName(ledger,'category',key).toLowerCase().includes(query.trim().toLowerCase());
 const priorMonth=previousMonth(month);
 const totals=(category:string,period=month)=>summary(active.filter(e=>e.category===category&&e.month===period));
 const cards=sortCategoryCards(categories.filter(matchesCategory).map(key=>({key,name:itemName(ledger,'category',key),...totals(key)})),sort);
 const selectedEntries=active.filter(e=>e.category===selected),stats=summary(selectedEntries.filter(e=>e.month===month));
 const months=Array.from({length:6},(_,i)=>{const [year,m]=month.split('-').map(Number),d=new Date(Date.UTC(year,m-1-(5-i),1));return d.toISOString().slice(0,7)});
 const trends=months.map(m=>({month:m,...summary(selectedEntries.filter(e=>e.month===m))})),max=Math.max(...trends.map(t=>Math.max(Math.abs(t.spend),t.income)),1);
 const history=selectedEntries.filter(e=>e.month===month).sort((a,b)=>b.date.localeCompare(a.date)||ledger.entries.indexOf(b)-ledger.entries.indexOf(a));
 function choose(c:string){setEditingIcon(false);setEditIcon(categoryIcon(ledger,c));setSelected(c)}
 function action(kind:string,title:string){onAction(selected!,kind,title)}
 return <>{!hideGuide&&<div className="info-box category-guide"><Tag size={19}/><p><strong>Start with what the money was for.</strong> Choose a category, then tell the app what happened. Purchases, shared costs, someone paying for you and refunds each open the right form.</p><button type="button" className="icon-button" aria-label="Dismiss category guide" onClick={dismissGuide}><X size={16}/></button></div>}<section className="panel categories-panel"><div className="panel-heading"><div><h2>Your categories</h2><p>Report month {monthName(month)}{currencyAffix(' · amounts in ')} · Net spending this month, after refunds</p></div><div className="category-heading-actions"><button className="button" onClick={()=>setAdding(!adding)}>Add category</button> <button className="button" onClick={()=>setShowArchived(!showArchived)}>{showArchived?'Show active categories':'Show archived categories'}</button></div></div>{adding&&<form className="category-add" onSubmit={async e=>{e.preventDefault();try{if(await onSave(addCategory(ledger,newName,newType,newIcon),'Category added: '+newName)){setAdding(false);setNewName('');setNewIcon('tag');setError('')}}catch(err){setError(err instanceof Error?err.message:'Check the category.')}}}><label>Category name<input required value={newName} onChange={e=>setNewName(e.target.value)}/></label><label>Type<select value={newType} onChange={e=>setNewType(e.target.value as 'expense'|'income')}><option value="expense">Expense</option><option value="income">Income</option></select></label><CategoryIconPicker name="new-category-icon" value={newIcon} onChange={setNewIcon}/><button className="button primary">Save category</button>{error&&<p className="form-error">{error}</p>}</form>}<div className="toolbar category-toolbar"><div className="search"><Search size={16}/><input aria-label="Search categories" placeholder="Search categories…" value={query} onChange={e=>setQuery(e.target.value)}/></div><select aria-label="Sort categories" value={sort} onChange={e=>setSort(e.target.value as CategorySort)}><option value="spending">Most spent</option><option value="name">A to Z</option><option value="original">Original order</option></select></div><div className="category-cards">{cards.map(t=>{const c=t.key,prior=totals(c,priorMonth),[,Icon]=ICON_DETAILS[categoryIcon(ledger,c)];
 const metric=categoryType(ledger,c)==='income'?'income':'spend';
 const share=metric==='spend'&&monthSpend?t.spend/monthSpend:0;
 return <button key={c} className="category-card" onClick={()=>choose(c)} aria-label={'Open category: '+c}><div className="category-card-heading"><span className="mini-icon"><Icon size={18} aria-hidden="true"/></span><h2>{itemName(ledger,'category',c)}</h2><ArrowUpRight size={16} aria-hidden="true"/></div><strong>{formatCurrency(t[metric])}</strong>{metric==='income'?<small>Income this month</small>:<span className={share<0?'category-share refund-share':share===0?'category-share zero-share':'category-share'} title={percent.format(share)+' of monthly net spending'}><span className="balance-share-track" aria-hidden="true"><span style={{width:Math.min(1,Math.abs(share))*100+'%'}}/></span><small>{percent.format(share)}</small></span>}<small className="category-comparison">{prior[metric]===0?(metric==='income'?'No income last month':'No spending last month'):describeDelta(t[metric],prior[metric],'last month')}</small><div className="category-card-foot"><span>{t.count} {t.count===1?'entry':'entries'}</span>{!showArchived&&<span>Add entry</span>}</div></button>})}</div>{!cards.length&&<div className="empty">No matching category. Try another name.</div>}</section>
 {selected&&<div className="modal-overlay"><section className="modal category-details" role="dialog" aria-modal="true" aria-labelledby="category-title"><div className="modal-heading"><div><p className="category-month">{monthName(month)}</p><h2 id="category-title">{itemName(ledger,'category',selected)}</h2></div><button data-dialog-close aria-label="Close category details" onClick={()=>setSelected(null)}><X size={21}/></button></div><LedgerItemActions ledger={ledger} kind="category" itemKey={selected} extraActions={<Popover open={editingIcon} onOpenChange={open=>{if(open)setEditIcon(categoryIcon(ledger,selected));setEditingIcon(open)}}>
  <PopoverTrigger asChild><button type="button" className="button" disabled={savingIcon}>Edit icon</button></PopoverTrigger>
  <PopoverContent className="category-icon-popover" align="start" sideOffset={8} onOpenAutoFocus={event=>{
 const input=document.querySelector<HTMLInputElement>('.category-icon-popover input:checked');
 if(input){event.preventDefault();input.focus({preventScroll:true})}
 }} onEscapeKeyDown={event=>{event.preventDefault();setEditingIcon(false)}} aria-label="Edit category icon">
 <form className="category-icon-editor" onSubmit={async event=>{
  event.preventDefault();
  if(savingIcon||editIcon===categoryIcon(ledger,selected))return;
  setSavingIcon(true);
  try{if(await onSave(setCategoryIcon(ledger,selected,editIcon),'Category icon updated: '+itemName(ledger,'category',selected)))setEditingIcon(false)}
  finally{setSavingIcon(false)}
 }}>
  <CategoryIconPicker name="edit-category-icon" value={editIcon} onChange={setEditIcon} disabled={savingIcon}/>
  <button className="button" disabled={savingIcon||editIcon===categoryIcon(ledger,selected)}>Save icon</button>
 </form>
  </PopoverContent>
 </Popover>} onSave={async(next,reason)=>{const ok=await onSave(next,reason);if(ok&&itemStatus(next,'category',selected)!==itemStatus(ledger,'category',selected))setSelected(null);return ok}}/>
 <div className="category-summary"><div><small>Net spending</small><strong>{formatCurrency(stats.spend)}</strong></div><div><small>Refunds</small><strong>{formatCurrency(stats.refunds)}</strong></div>{(categoryType(ledger,selected!)==='income'||stats.income!==0)&&<div><small>Income</small><strong>{formatCurrency(stats.income)}</strong></div>}</div>{itemStatus(ledger,'category',selected)==='active'&&<><h3>What happened?</h3><div className="guided-actions">{categoryType(ledger,selected!)==='income'?<button className="guided-action" onClick={()=>action('income','I received income')}><ArrowDownLeft size={20}/><div><strong>I received income</strong><small>Choose where the money arrived and the report month.</small></div><ArrowUpRight size={15}/></button>:(selected==='Food'?[...ACTIONS,{kind:'weeklyShare',title:'My weekly Splitwise share—no bank movement',text:'Enter only your own food share. No payment or personal debt is created.',Icon:UtensilsCrossed}]:ACTIONS).map(({kind,title,text,Icon})=><button key={kind} className="guided-action" onClick={()=>action(kind,title)}><Icon size={20}/><div><strong>{title}</strong><small>{text}</small></div><ArrowUpRight size={15}/></button>)}</div><div className="form-help">Transfers and loan repayments do not belong to spending categories. Use Accounts for transfers and People for repayments. In Food, use “My weekly Splitwise share” to record your consumption without a bank movement.</div></>}<div className="detail-section"><h2>Six-month trend</h2><p className="muted-paragraph">By Report Month · net spending{categoryType(ledger,selected!)==='income'?' and income':''}. Negative spending means net refunds.</p><div className="category-trend">{trends.map(t=><div key={monthName(t.month)}><span>{monthName(t.month)}</span><div className="bar-track"><div className="bar-fill" style={{width:`${Math.max(0,Math.abs(categoryType(ledger,selected!)==='income'?t.income:t.spend)/max*100)}%`}}/></div><b>{money(categoryType(ledger,selected!)==='income'?t.income:t.spend)}</b></div>)}</div></div><div className="detail-section">
  <div className="category-history-heading"><h2>This month’s activity</h2><button className="text-button" onClick={()=>onViewAll(selected)}>View all</button></div>
  <div className="person-history">{history.slice(0,5).map(e=><button key={e.id} onClick={()=>onView(e)}><div><strong>{e.description}</strong><small>{formatDate(e.date)}</small></div><b>{formatCurrency(e.amount)}</b></button>)}</div>
  {!history.length&&<p className="muted-paragraph">No entries for this category in this month yet.</p>}
 </div></section></div>}</>;
}
const ICON_DETAILS:Record<CategoryIcon,readonly [string,LucideIcon]>={
 tag:['Tag',Tag],food:['Food',UtensilsCrossed],grocery:['Groceries',ShoppingBasket],home:['Home',House],
 car:['Transport',CarFront],fuel:['Fuel',Fuel],shopping:['Shopping',ShoppingBag],health:['Health',HeartPulse],
 person:['Personal',UserRound],charity:['Charity',HeartHandshake],gift:['Gift',Gift],bills:['Bills',Receipt],
 salary:['Income',Wallet],education:['Education',GraduationCap],travel:['Travel',Plane],
 entertainment:['Entertainment',Gamepad2],family:['Family',Users],pets:['Pets',PawPrint],
 work:['Work',BriefcaseBusiness],savings:['Savings',PiggyBank],
};

function CategoryIconPicker({name,value,onChange,disabled}:{name:string;value:CategoryIcon;onChange:(value:CategoryIcon)=>void;disabled?:boolean}){
 return <fieldset className="category-icon-picker" disabled={disabled}>
  <legend>Category icon</legend>
  <div className="category-icon-options">{CATEGORY_ICONS.map(icon=>{
   const [label,Icon]=ICON_DETAILS[icon];
   return <label key={icon} className="category-icon-option" title={label}>
    <input type="radio" className="visually-hidden" name={name} value={icon} checked={value===icon} onChange={()=>onChange(icon)}/>
    <span className="visually-hidden">{label}</span><Icon size={19} aria-hidden="true"/>
   </label>;
  })}</div>
 </fieldset>;
}
