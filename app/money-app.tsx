'use client';
import {formatMoney as money} from '../lib/display-format';
import {createTransactionUndo,undoTransaction,type TransactionUndo} from '../lib/transaction-undo';
import {HelpPanel} from './help-panel';
import {ReportsPanel} from './reports-panel';
import {Stat} from './stat';
import {OverviewPanel} from './overview-panel';
import {handleDialogKey} from './dialog-keys';
import {PersonSelect} from './person-select';
import {entryWarnings} from '../lib/entry-warnings';
import {transactionSearch} from '../lib/transaction-search';
import {parseAmount,previewAmount} from '../lib/money-input';
import {nextFoodShareRange} from '../lib/food-share-dates';
import {BackupCheck} from './backup-check';
import {TransactionCells,TransactionHeadings} from './transaction-display';
import {AutomaticReports,type VerifiedBackup} from './automatic-reports';
import {desktopHost} from './desktop-host';
import {BACKUP_BYTES} from '../lib/backup-limits';
import {createBackup} from '../lib/backup';
import {accountNames,addAccount,accountType,type AccountType} from '../lib/accounts';
import {activeItems,itemName,itemStatus,preferredItem} from '../lib/ledger-items';
import {categoryType} from '../lib/categories';
import {AccountTypeOptions,LedgerItemActions} from './ledger-item-actions';
import {useEffect,useRef,useState} from 'react';
import {LayoutDashboard,ArrowLeftRight,Wallet,Users,UtensilsCrossed,BarChart3,ShieldCheck,Plus,Search,X,Download,Check,AlertCircle,Pencil,Menu,CheckCircle2,Tag,BookOpen} from 'lucide-react';
import {KINDS,reflow,totals,reconciliation,type Ledger,type Entry} from '../lib/ledger';
import {normalize,personName,prepareEntry,previewChanges,deleteEntry,LEGACY_TYPES,type Change} from '../lib/v2';
import {Details,PeoplePanel,Changes,RecordedTogether} from './v2-panels';
import {ParkingLinkEditor,ParkingChanges} from './month-end';
import {ShortcutsPanel,ShortcutChanges} from './shortcuts-panel';
import {shortcutFromEntry,type Shortcut} from '../lib/shortcuts';
import {CategoryPanel} from './category-panel';
import {BalanceCheck} from './balance-check';
import {ReviewPanel,ReviewMetadataChanges} from './review-panel';
import {ExistingRefundEditor,RefundLinkChanges} from './existing-refund-editor';
import {RecoveryEditor} from './recovery-editor';
import {reviewData,updateReview,duplicatePairs,checkpointView} from '../lib/review';
import {GroupEditor,ReceiptEditor,GroupList,type ReceiptTarget} from './group-payments';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fresh=()=>({kind:'expense',legacyType:'Expense',date:today(),month:today().slice(0,7),description:'',category:'Food',amount:'',account:'Alfalah',to:'BOP Savings',person:'',notes:'',foodRange:{from:'',to:''},templateId:'',ownShare:'',splits:[{person:'',amount:''}]});
const NAV=[['overview','Overview',LayoutDashboard],['transactions','Transactions',ArrowLeftRight],['accounts','Accounts',Wallet],['categories','Categories',Tag],['people','People',Users],['lunch','Group payments',UtensilsCrossed],['reports','Reports',BarChart3],['review','Reconcile & Review',CheckCircle2],['shortcuts','Shortcuts',Plus],['backup','Backup & recovery',ShieldCheck],['help','Help & guide',BookOpen]] as const;
async function readLedgerResponse(response:Response,action:string){
 const type=response.headers.get('content-type')||'';
 if(!type.toLowerCase().includes('application/json')){
  throw Error(`Could not ${action}. The server returned an unexpected response (HTTP ${response.status}).`);
 }
 const data=await response.json() as {error?:string;data?:Ledger;revision:number;savedAt:string|null;setupWarning?:string};
 if(!response.ok)throw Error(data.error||`Could not ${action} (HTTP ${response.status}).`);
 if(!data.data)throw Error(`Could not ${action}. The response did not include the ledger.`);
 return {...data,data:data.data};
}
type EntryDraft={id:string;form:ReturnType<typeof fresh>;context:string;monthOverridden:boolean};

export default function MoneyApp(){
 const [ledger,setLedger]=useState<Ledger|null>(null),[revision,setRevision]=useState(0),[savedAt,setSavedAt]=useState<string|null>(null),[page,setPage]=useState('overview'),[month,setMonth]=useState(today().slice(0,7)),[year,setYear]=useState(today().slice(0,4)),[search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[limit,setLimit]=useState(50),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[mobile,setMobile]=useState(false),[modal,setModal]=useState(false),[form,setForm]=useState(fresh()),[editId,setEditId]=useState<string|null>(null),[formError,setFormError]=useState(''),[history,setHistory]=useState<any[]>([]),[deleteId,setDeleteId]=useState<string|null>(null);
 useEffect(()=>{
  let previous=today().slice(0,7);
  function refreshMonth(){
   const current=today().slice(0,7);
   if(current===previous)return;
   const oldMonth=previous;
   previous=current;
   setMonth(selected=>selected===oldMonth?current:selected);
   setYear(selected=>selected===oldMonth.slice(0,4)?current.slice(0,4):selected);
  }
  const interval=window.setInterval(refreshMonth,15_000);
  window.addEventListener('focus',refreshMonth);
  document.addEventListener('visibilitychange',refreshMonth);
  return ()=>{
   window.clearInterval(interval);
   window.removeEventListener('focus',refreshMonth);
   document.removeEventListener('visibilitychange',refreshMonth);
  };
 },[]);
 const [groupEditor,setGroupEditor]=useState<{payee?:string;editId?:string}|null>(null),[receiptEditor,setReceiptEditor]=useState<ReceiptTarget|null>(null);
 const [recoveryEditor,setRecoveryEditor]=useState<{kind:string;expenseId?:string;editId?:string;category?:string}|null>(null);
 const [parkingLink,setParkingLink]=useState<{id?:string;month:string}|null>(null);
 const [existingRefund,setExistingRefund]=useState<{refundId:string;expenseId?:string}|null>(null);
 const [showArchivedAccounts,setShowArchivedAccounts]=useState(false);
 const [addingAccount,setAddingAccount]=useState(false),[accountEditor,setAccountEditor]=useState<string|null>(null);
 const [balanceAccount,setBalanceAccount]=useState(''),[transactionAccount,setTransactionAccount]=useState('');
 const accountEditorTrigger=useRef<HTMLButtonElement|null>(null);
 function closeAccountEditor(){
  setAccountEditor(null);
  requestAnimationFrame(()=>accountEditorTrigger.current?.isConnected&&accountEditorTrigger.current.focus());
 }
 const [newAccount,setNewAccount]=useState(''),[newAccountType,setNewAccountType]=useState<AccountType>('current');
 const [exportRange,setExportRange]=useState({basis:'actual' as 'actual'|'report',from:'',to:''}),[rangeEnabled,setRangeEnabled]=useState(false);
 const [entryContext,setEntryContext]=useState('');
 const [detailId,setDetailId]=useState<string|null>(null),[editReason,setEditReason]=useState(''),[review,setReview]=useState<{data:Ledger;reason:string;changes:Change[]}|null>(null);
 const [dateBasis,setDateBasis]=useState('all'),[dateFrom,setDateFrom]=useState(''),[dateTo,setDateTo]=useState('');
 const [selectedTransaction,setSelectedTransaction]=useState(''),[manualBackup,setManualBackup]=useState<VerifiedBackup|null>(null),[exporting,setExporting]=useState(false),[saveFailed,setSaveFailed]=useState(false);
 const [monthOverridden,setMonthOverridden]=useState(false);
 const busy=useRef(false),draftId=useRef(''),originalEntry=useRef(''),formStart=useRef(''),entryTrigger=useRef<HTMLElement|null>(null);
 const [savedDraft,setSavedDraft]=useState<EntryDraft|null>(null);
 const [moreTypes,setMoreTypes]=useState(false);
 const searchField=useRef<HTMLInputElement>(null);
 function resetEntry(){
  draftId.current=crypto.randomUUID();
  originalEntry.current='';
  formStart.current='';
  entryTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  setMonthOverridden(false);
  setMoreTypes(false);
 }
 function clearDraft(){
  setSavedDraft(null);
  desktopHost()?.postMessage('clear-entry-draft');
 }
 function storeDraft(){
  const draft={id:draftId.current,form,context:entryContext,monthOverridden};
  setSavedDraft(draft);
  desktopHost()?.postMessage('entry-draft:'+JSON.stringify(draft));
 }
 function resumeDraft(){
  if(!savedDraft)return;
  resetEntry();
  draftId.current=savedDraft.id;
  setForm(savedDraft.form);
  setEntryContext(savedDraft.context);
  setMonthOverridden(savedDraft.monthOverridden);
  setEditId(null);
  setEditReason('');
  setFormError('');
  setModal(true);
 }
 function finishEntry(keepDraft=false){
  if(!keepDraft&&!editId&&savedDraft?.id===draftId.current)clearDraft();
  setModal(false);
  requestAnimationFrame(()=>{const trigger=entryTrigger.current;if(trigger?.isConnected)trigger.focus();else if(page==='transactions')searchField.current?.focus()});
 }
 function closeEntry(){
  if(busy.current)return;
  if((JSON.stringify(form)!==formStart.current||editReason)&&!window.confirm('Discard this transaction draft?'))return;
  finishEntry();
 }
 useEffect(()=>{
  if(modal&&!formStart.current)formStart.current=JSON.stringify(form);
 },[modal,form]);
 useEffect(()=>{
  if(!desktopHost()||!modal||editId||!draftId.current)return;
  if(JSON.stringify(form)===formStart.current&&savedDraft?.id!==draftId.current)return;
  if(savedDraft&&savedDraft.id!==draftId.current)return;
  storeDraft();
 },[modal,editId,form,entryContext,monthOverridden]);
 useEffect(()=>{
  const host=desktopHost();
  if(!host)return;
  const receive:Parameters<typeof host.addEventListener>[1]=({data})=>{
   if(data.type==='entry-draft'){
    if(data.error)setError(data.error);
    if(data.draft)try {
     const draft=JSON.parse(data.draft) as EntryDraft;
     if(typeof draft.id==='string'&&typeof draft.form?.amount==='string'&&Array.isArray(draft.form.splits))
      setSavedDraft(draft);
    }catch{}
    return;
   }
   if((data.type==='backup-status' ||data.type==='export-result'&&data.state==='saved'&&data.json)&&data.at&&data.path&&typeof data.revision==='number')
    setManualBackup({at:data.at,path:data.path,revision:data.revision});
   if(data.type!=='export-result')return;
   setExporting(false);
   if(data.state==='saved'){
    setNotice((data.json?'Backup verified and saved to '+data.path:'Excel report saved to '+data.path)+(data.error?' · '+data.error:''));
   }else if(data.state==='failed')setError(data.error||'Export failed. Check the destination and try again.');
   else setNotice('Export canceled.');
  };
  host.addEventListener('message',receive);
  host.postMessage('backup-status');
  host.postMessage('entry-draft');
  return ()=>host.removeEventListener('message',receive);
 },[]);
 useEffect(()=>{
  const host=desktopHost();
  if(!host)return;
  let previous='';
  const notify=()=>{
   const draft=modal||!!groupEditor||!!receiptEditor||!!recoveryEditor||!!parkingLink||!!existingRefund||!!deleteId||!!review||!!document.querySelector('.modal form');
   const state=saving||busy.current?'state:busy':draft?(modal&&!editId&&savedDraft?.id===draftId.current?'state:persisted-draft':'state:draft'):'state:idle';
   if(state!==previous){host.postMessage(state);previous=state}
  };
  notify();
  const observer=new MutationObserver(notify);
  observer.observe(document.body,{childList:true,subtree:true});
  return ()=>observer.disconnect();
 },[modal,groupEditor,receiptEditor,recoveryEditor,parkingLink,existingRefund,deleteId,review,saving,editId,savedDraft]);
 const reviewOpen=!!review;
 useEffect(()=>{
  if(reviewOpen)document.getElementById('review-title')?.focus({preventScroll:true});
 },[reviewOpen]);
 useEffect(()=>{
  const handle=(e:KeyboardEvent)=>{
   if(handleDialogKey(e,busy.current))return;
   if(e.key==='Tab'&&(modal||review||accountEditor||balanceAccount)){
    const dialog=document.querySelector(review?'.review-overlay .modal':accountEditor?'.account-editor-dialog':balanceAccount?'.balance-check-dialog':'.entry-overlay .modal');
    const controls=Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href]')||[]).filter(el=>el.getClientRects().length>0);
    const first=controls[0],last=controls.at(-1);
    if(first&&last&&(!dialog?.contains(document.activeElement)||(!e.shiftKey&&document.activeElement===last)||(e.shiftKey&&document.activeElement===first))){
     e.preventDefault();(e.shiftKey?last:first).focus();
    }
   }
   if(e.key==='Escape'&&modal&&!review){e.preventDefault();closeEntry();return}
   if(!ledger||modal||review||accountEditor||balanceAccount||detailId||deleteId||groupEditor||receiptEditor||recoveryEditor||parkingLink||existingRefund)return;
   if(e.ctrlKey&&e.key.toLowerCase()==='n'){e.preventDefault();openEntry()}
   if(e.ctrlKey&&e.key.toLowerCase()==='f'){e.preventDefault();setPage('transactions');requestAnimationFrame(()=>searchField.current?.focus())}
  };
  window.addEventListener('keydown',handle);
  return ()=>window.removeEventListener('keydown',handle);
 });

 async function load(){setUndo(null);setLoading(true);setError('');try{const r=await fetch('/api/ledger',{cache:'no-store'});const j=await readLedgerResponse(r,'load the ledger');if(j.setupWarning)setError(j.setupWarning);setLedger(normalize(j.data));setRevision(j.revision);setSavedAt(j.savedAt)}catch(e){setError(String(e instanceof Error?e.message:e))}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 useEffect(()=>{if(ledger&&!loading)desktopHost()?.postMessage('state:ready')},[ledger,loading]);
 useEffect(()=>{if(page==='backup')fetch('/api/ledger?history=1').then(r=>r.json()).then((j:any)=>setHistory(j.history||[])).catch(()=>setError('Could not load saved versions.'))},[page,revision]);
 const [undo,setUndo]=useState<TransactionUndo|null>(null);
 useEffect(()=>{
  if(!undo)return;
  const timer=window.setTimeout(()=>setUndo(null),Math.max(0,undo.expires-Date.now()));
  return ()=>window.clearTimeout(timer);
 },[undo]);
 async function applyUndo(){
  if(!ledger||!undo||busy.current)return;
  try{
   const next=undoTransaction(ledger,undo,revision);
   setUndo(null);
   await save(next,'Undone within a minute: '+undo.entry.description,true);
  }catch(err){setUndo(null);setError(err instanceof Error?err.message:'Could not undo this save.');}
 }
 async function save(next:Ledger,reason:string,isUndo=false){
  if(busy.current)return false;
  busy.current=true;
  setSaving(true);
  setSaveFailed(false);
  setError('');
  desktopHost()?.postMessage('state:busy');
  try{
   const r=await fetch('/api/ledger',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:next,revision,reason})});
   if(r.status===409){
    setUndo(null);
    const latest=await readLedgerResponse(await fetch('/api/ledger',{cache:'no-store'}),'reload the ledger');
    setLedger(normalize(latest.data));setRevision(latest.revision);setSavedAt(latest.savedAt);
    setReview(null);
    if(isUndo)throw Error('Undo was skipped because the ledger has a newer save.');
    if(modal&&!editId&&latest.data.entries.some(e=>e.id===draftId.current&&!e.deleted)){
     setNotice('This transaction was already saved.');
     return true;
    }
    throw Error('The ledger changed. Latest records loaded. Review your open draft before saving again.');
   }
   const j=await readLedgerResponse(r,'confirm the save');
   const committed=normalize(j.data);
   setLedger(committed);setRevision(j.revision);setSavedAt(j.savedAt);
   const reversible=!isUndo&&ledger?createTransactionUndo(ledger,committed,j.revision):null;
   setUndo(reversible);
   setNotice(reversible?'':reason+' · saved');
   return true;
  }catch(e){
   const message=e instanceof Error?e.message:'Could not confirm the save.';
   setSaveFailed(true);setError(message);
   if(modal)setFormError(message);
   return false;
  }finally{setSaving(false);busy.current=false}
 }
 function incomeCategory(){
  const categories=activeItems(ledger!,'category');
  return categories.includes('Salary')?'Salary':categories.find(key=>categoryType(ledger!,key)==='income')||'';
 }
 function newForm(){
  const base=fresh();
  if(!ledger)return base;
  const previous=ledger.entries.findLast(entry=>entry.kind==='expense'&&!entry.deleted&&!entry.sourceRow);
  const account=preferredItem(ledger,'account',previous?.account||base.account);
  const to=activeItems(ledger,'account').filter(key=>key!==account);
  return {...base,account,to:to.includes(base.to)?base.to:to[0]||'',category:preferredItem(ledger,'category',previous?.category||base.category)};
 }
 function openEntry(kind='expense'){resetEntry();if(['officeRecovery','merchantRefund'].includes(kind)){setRecoveryEditor({kind});return}setEntryContext('');setForm({...newForm(),kind,...kind==='weeklyShare'&&{foodRange:nextFoodShareRange(ledger!,today())},category:['splitwiseShare','lunchAdvance','lunchRecovery','splitwiseFunding','weeklyShare'].includes(kind)?'Food':kind==='income'?incomeCategory():newForm().category});setEditId(null);setEditReason('');setFormError('');setModal(true)}
 function useShortcut(shortcut:Shortcut){
  if([shortcut.account,shortcut.to].some(key=>key&&itemStatus(ledger!,'account',key)!=='active')
   ||shortcut.category&&itemStatus(ledger!,'category',shortcut.category)!=='active'){
   setError('Restore the archived account or category, or edit this shortcut before using it.');
   window.scrollTo(0,0);
   return;
  }
  openEntry(shortcut.kind);
  setEntryContext(shortcut.name);
  setForm({...newForm(),kind:shortcut.kind,description:shortcut.description,category:shortcut.category,
   account:shortcut.account,to:shortcut.to||'BOP Savings',amount:shortcut.amount?String(shortcut.amount/100):'',
   templateId:shortcut.id,month:shortcut.recurring?shortcut.nextDue.slice(0,7):today().slice(0,7)});
 }
 function edit(e:Entry){setSelectedTransaction(e.id);if(['officeRecovery','merchantRefund'].includes(e.kind)){setDetailId(null);setRecoveryEditor({kind:e.kind,editId:e.id});return}if(e.kind==='groupPayment'){setDetailId(null);setGroupEditor({editId:e.id});return}if(e.kind==='groupReceipt'&&e.receipt){setDetailId(null);setReceiptEditor({...e.receipt,editId:e.id});return}resetEntry();originalEntry.current=JSON.stringify(e);setEntryContext('');setForm({...newForm(),...e,amount:String(e.amount/100),to:e.to||'BOP Savings',ownShare:e.ownShare==null?'':String(e.ownShare/100),splits:e.splits?.map(s=>({...s,amount:String(s.amount/100)}))||[{person:'',amount:''}]});setEditId(e.id);setEditReason('');setDetailId(null);setFormError('');setModal(true)}
 function buildCandidate(){
 if(!ledger)throw Error('Ledger is not loaded.');
 if(editId&&!editReason.trim())throw Error('Explain why you are changing this transaction.');
 const old=ledger.entries.find(e=>e.id===editId);
 if(editId&&(!old||old.deleted||JSON.stringify(old)!==originalEntry.current))throw Error('This transaction changed. Copy any draft values you need, then reopen the latest entry.');
 const raw={...form,foodRange:form.kind==='weeklyShare'&&(form.foodRange.from||form.foodRange.to)?form.foodRange:undefined,id:editId||draftId.current,amount:parseAmount(form.amount),effects:old?.effects||{accounts:{},spend:0,income:0,receivable:{},payable:{},clearing:0,splitwise:0},ownShare:form.kind==='shared'?parseAmount(form.ownShare):undefined,splits:form.kind==='shared'?form.splits.map(s=>({person:s.person,amount:parseAmount(s.amount)})):undefined};
 return prepareEntry(ledger,raw,old);
 }
 function submit(ev:React.FormEvent){
  ev.preventDefault();
  if(!ledger||busy.current)return;
  try{
   setFormError('');
   const next=buildCandidate(),reason=editId?'Transaction corrected: '+editReason.trim():'Transaction added';
   const ordinary=!editId&&['expense','income','transfer','lend','borrow'].includes(form.kind)&&!form.templateId;
   const duplicate=ordinary&&duplicatePairs(next,new Set([draftId.current])).length>0;
   const checkpoint=ordinary&&reviewData(next).checkpoints.some(c=>checkpointView(next,c).needsRecheck&&!checkpointView(ledger,c).needsRecheck);
   if(ordinary&&!duplicate&&!checkpoint&&!entryWarnings(ledger,next,today()).length&&createTransactionUndo(ledger,next,revision)){
    void save(next,reason).then(saved=>{if(saved)finishEntry()});
   }else setReview({data:next,reason,changes:previewChanges(ledger,next)});
  }catch(e){setFormError(e instanceof Error?e.message:'Please check the entry.')}
 }
 function duplicate(e:Entry){if(e.parking){setDetailId(null);setMonth(e.parking.allocations[0].month);navigate('reports');setNotice('Choose the surplus month here so the same surplus is not parked twice.');return}if(e.effects.spend<0){setDetailId(null);setRecoveryEditor({kind:'officeRecovery',category:e.category});return}if(e.recoveries){setDetailId(null);setRecoveryEditor({kind:e.kind});return}if(e.kind==='groupPayment'){setDetailId(null);setGroupEditor({payee:e.person});return}if(e.kind==='groupReceipt'){setError('Record a new receipt from the outstanding assignment so it stays linked.');setDetailId(null);navigate('lunch');return}resetEntry();setEntryContext('Duplicate transaction');const map:Record<string,string>={Expense:'expense',Refund:'refund',Income:'income',Lent:'lend','Loan Returned':'repaymentIn',Borrowed:'borrow','Borrowing Repaid':'repaymentOut',Saving:'transfer','Savings Withdrawal':'transfer','Cash Withdrawal':'transfer','Cash Deposit':'transfer'};const account=e.account==='Current'?(ledger?.tailoringVersion?'Alfalah':'Legacy Current'):e.account==='Savings'?'BOP Savings':e.account;const kind=e.kind==='legacy'?(map[e.legacyType||'']||''):e.kind;let source=account,to=e.to||'BOP Savings';if(e.legacyType==='Savings Withdrawal'){source='BOP Savings';to=account}if(e.legacyType==='Cash Withdrawal'){source=ledger?.tailoringVersion?'Alfalah':'Legacy Current';to='Cash'}if(e.legacyType==='Cash Deposit'){source='Cash';to=ledger?.tailoringVersion?'Alfalah':'Legacy Current'}const validAccount=activeItems(ledger!,'account').includes(source)||['weeklyShare','personExpense','splitwiseShare'].includes(kind);setForm({...newForm(),kind:validAccount?kind:'',description:e.description,amount:String(e.amount/100),category:e.category,person:e.person,notes:e.notes,account:validAccount?source:newForm().account,to,ownShare:e.ownShare==null?'':String(e.ownShare/100),splits:e.splits?.map(x=>({person:x.person,amount:String(x.amount/100)}))||[{person:'',amount:''}]});setEditId(null);setEditReason('');setFormError(kind&&validAccount?'':'Choose the type and paying account for this new transaction. The Excel movement was not automatically reclassified.');setDetailId(null);setModal(true)}
 useEffect(()=>{
  if(!exporting)return;
  const timeout=window.setTimeout(()=>{
   setExporting(false);
   setError('The export did not report a result. Check the destination before trying again.');
  },180000);
  return ()=>window.clearTimeout(timeout);
 },[exporting]);
 async function downloadJSON(){
  if(!ledger||exporting)return;
  setExporting(!!desktopHost());setError('');
  try{
   const blob=new Blob([JSON.stringify(await createBackup(ledger,revision))],{type:'application/json'});
   if(blob.size>BACKUP_BYTES)throw Error('This ledger exceeds the supported backup size.');
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download=`Haider_Money_Backup_${today()}.json`;link.click();
   setTimeout(()=>URL.revokeObjectURL(url),10000);
   if(!desktopHost())setNotice('Backup download requested. Verify the downloaded file below.');
  }catch(e){setExporting(false);setError(e instanceof Error?e.message:'Backup export failed.')}
 }
 if(loading||!ledger)return <div className="loading"><img className="balancebook-mark" src="/favicon.svg" alt=""/><h1>BalanceBook</h1><p>{loading?'Opening your ledger…':error}</p>{!loading&&<><button onClick={load}>Try again</button></>}</div>;
 const position=totals(ledger),checks=reconciliation(ledger),matched=checks.filter(r=>r.difference===0).length;
 const active=ledger.entries.filter(e=>!e.deleted);
 const sorted=active.slice().reverse().sort((a,b)=>b.date.localeCompare(a.date));
 const matchesSearch=transactionSearch(search);
 const filtered=(filter==='deleted'?[...ledger.entries].filter(e=>e.deleted).sort((a,b)=>b.date.localeCompare(a.date)):sorted).filter(e=>(filter==='deleted'||filter==='all'||(filter==='new'?e.kind!=='legacy':e.kind==='legacy'))&&(dateBasis==='all'||(!dateFrom||(dateBasis==='actual'?e.date:e.month)>=dateFrom)&&(!dateTo||(dateBasis==='actual'?e.date:e.month)<=dateTo))&&(!transactionAccount||Object.hasOwn(e.effects.accounts,transactionAccount))&&matchesSearch(e,`${e.description} ${e.person} ${personName(ledger,e.person)} ${(e.splits||[]).map(s=>personName(ledger,s.person)).join(' ')} ${e.category} ${itemName(ledger,'category',e.category)} ${e.account} ${itemName(ledger,'account',e.account)} ${itemName(ledger,'account',e.to||'')} ${e.legacyType||KINDS[e.kind]}`));
 
 const navigate=(s:string)=>{setPage(s);setMobile(false)};
 const label= NAV.find(n=>n[0]===page)?.[1]||'Overview';
 const txnTable=(entries:Entry[],compact=false)=><div className="table-scroll"><table className="transactions"><TransactionHeadings actions={!compact}/><tbody>{entries.map(e=><tr key={e.id} className={selectedTransaction===e.id?'selected-transaction':undefined}>
  <TransactionCells entry={e} ledger={ledger} onOpen={()=>{setSelectedTransaction(e.id);setDetailId(e.id)}}/>
  {!compact&&<td>{e.deleted?<button className="text-button" onClick={()=>setDetailId(e.id)}>View / restore</button>:<div className="row-actions"><button className="button" onClick={()=>edit(e)}><Pencil size={14}/>Edit</button></div>}</td>}
 </tr>)}</tbody></table>{!entries.length&&<div className="empty">No transactions here yet.</div>}</div>;
 const navButton=([id,name,Icon]:typeof NAV[number])=><button key={id} aria-current={page===id?'page':undefined} className={page===id?'active':''} onClick={()=>navigate(id)}><Icon size={17}/><span>{name}</span></button>;
 return <div className="app-shell"><aside inert={modal||!!review||!!accountEditor||!!balanceAccount||undefined} className={'sidebar '+(mobile?'open':'')}><button className="brand" onClick={()=>navigate('overview')}><img className="balancebook-mark" src="/favicon.svg" alt=""/>BalanceBook</button><nav aria-label="Ledger">{NAV.slice(0,5).map(navButton)}<details open={NAV.slice(5,9).some(n=>n[0]===page)||undefined}><summary>Reports &amp; tools</summary>{NAV.slice(5,9).map(navButton)}</details>{navButton(NAV[9])}{navButton(NAV[10])}</nav><p className="balancebook-credit">Made by Haider Ali</p></aside>{mobile&&<div className="scrim" onClick={()=>setMobile(false)}/>}
 <main inert={modal||!!review||!!accountEditor||!!balanceAccount||undefined}><div className="content" id={page==='help'?'help-top':undefined}><header className="page-title"><div className="page-title-heading"><button className="mobile-menu" aria-label="Open navigation" onClick={()=>setMobile(true)}><Menu size={21}/></button><h1>{label}</h1></div><div className="title-actions">{['overview','reports','categories','review'].includes(page)&&<input aria-label="Report month" type="month" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value)}}/>}<button className="button primary" onClick={()=>page==='lunch'?setGroupEditor({}):openEntry()}><Plus size={17}/>{page==='lunch'?'New group payment':'Add transaction'}</button></div></header>
 {savedDraft&&ledger&&!modal&&!ledger.entries.some(e=>e.id===savedDraft.id)&&<div className="button-row"><button className="button" onClick={resumeDraft}>Resume draft</button><button className="button" onClick={()=>{if(window.confirm('Discard the saved draft?'))clearDraft()}}>Discard draft</button></div>}
 <div className="ledger-status" role="status"><span className={'status-dot '+(saveFailed?'failed':'')}/> {saving?'Saving…':saveFailed?'Save needs attention':savedAt?'Saved locally':'Local ledger opened'}</div>
 {error&&<div role="alert" className="banner danger"><AlertCircle size={18}/><span>{error}</span><button onClick={()=>setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}
 {undo&&<div className="undo-toast">
  <span role="status">{undo.entry.deleted?'Deleted':undo.before?'Updated':'Saved'} {undo.entry.description} · PKR {money(undo.entry.amount)}</span>
  <button className="button" disabled={saving} onClick={()=>void applyUndo()}>Undo</button>
  <button className="icon-button" onClick={()=>setUndo(null)} aria-label="Dismiss Undo"><X size={16}/></button>
 </div>}
 {notice&&<div role="status" className="banner success"><CheckCircle2 size={17}/><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss notification"><X size={16}/></button></div>}
 {page==='overview'&&<OverviewPanel ledger={ledger} month={month} revision={revision}
  recentActivity={txnTable(sorted.slice(0,6),true)} navigate={navigate} useShortcut={useShortcut}
  onTransactions={()=>{setSearch('');setDateBasis('all');setFilter('all');setTransactionAccount('');navigate('transactions')}}/>}
 {page==='transactions'&&<section className="panel"><div className="panel-heading"><h2>Transaction ledger <span className="count">{filtered.length}</span></h2></div><div className="toolbar transaction-filters">{transactionAccount&&<button className="button" onClick={()=>setTransactionAccount('')}>Account: {itemName(ledger,'account',transactionAccount)} · Clear</button>}<div className="search"><Search size={17}/><input ref={searchField} aria-label="Search transactions" placeholder="Search description, amount, date or account…" value={search} onChange={e=>{setSearch(e.target.value);setLimit(50)}}/></div><select aria-label="Transaction date scope" value={dateBasis} onChange={e=>{setDateBasis(e.target.value);setDateFrom('');setDateTo('');setLimit(50)}}><option value="all">All dates</option><option value="actual">Actual date</option><option value="report">Report month</option></select><select aria-label="Transaction source" value={filter} onChange={e=>{setFilter(e.target.value);setLimit(50)}}><option value="all">All entries</option><option value="new">App entries</option><option value="legacy">Excel history</option><option value="deleted">Deleted entries</option></select>{dateBasis!=='all'&&<div className="date-range"><label>From<input type={dateBasis==='actual'?'date':'month'} value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></label><label>Through<input type={dateBasis==='actual'?'date':'month'} value={dateTo} onChange={e=>setDateTo(e.target.value)}/></label></div>}</div>{txnTable(filtered.slice(0,limit))}{!filtered.length&&(search||dateBasis!=='all'||filter!=='all'||transactionAccount)&&<div className="center"><button className="button" onClick={()=>{setSearch('');setDateBasis('all');setFilter('all');setTransactionAccount('');setLimit(50)}}>Clear filters</button></div>}{filtered.length>limit&&<div className="center"><button className="button" onClick={()=>setLimit(limit+100)}>Show more transactions</button></div>}</section>}
 {page==='accounts'&&<>
  <p className="section-context">Balances across all recorded dates, including future entries.</p>
  <section className="panel account-ledger">
   <div className="panel-heading account-toolbar">
    <button className="button primary" aria-expanded={addingAccount} onClick={()=>setAddingAccount(!addingAccount)}><Plus size={16}/>{addingAccount?'Cancel add account':'Add account'}</button>
    <button className="button" onClick={()=>setShowArchivedAccounts(!showArchivedAccounts)}>{showArchivedAccounts?'Show active accounts':'Show archived accounts'}</button>
   </div>
   {addingAccount&&<form className="account-add" onSubmit={async e=>{
    e.preventDefault();
    try{
     if(await save(addAccount(ledger,newAccount,newAccountType),'Account added: '+newAccount.trim())){
      setNewAccount('');setNewAccountType('current');setAddingAccount(false);setShowArchivedAccounts(false);
     }
    }catch(err){setError(err instanceof Error?err.message:'Check the account name.')}
   }}>
    <label>Account name<input autoFocus required maxLength={60} placeholder="e.g. HBL" value={newAccount} onChange={e=>setNewAccount(e.target.value)}/></label>
    <label>Account type<select value={newAccountType} onChange={e=>setNewAccountType(e.target.value as AccountType)}><AccountTypeOptions/></select></label>
    <button className="button primary" type="submit" disabled={saving}>Save account</button>
   </form>}
   <div className="table-scroll"><table><thead><tr><th>Account</th><th>Type</th><th className="right">Balance (PKR)</th><th>Actions</th></tr></thead><tbody>
   {accountNames(ledger).filter(a=>itemStatus(ledger,'account',a)===(showArchivedAccounts?'archived':'active')).map(a=>{
    const label=itemName(ledger,'account',a),type=accountType(ledger,a);
    const destinations=activeItems(ledger,'account').filter(key=>key!==a);
    return <tr key={a}><td><strong>{label}</strong></td><td>{type[0].toUpperCase()+type.slice(1)}</td><td className="right"><strong>{money(position.accounts[a]||0)}</strong>{position.accounts[a]<0&&<small>Payments exceed the opening balance and receipts.</small>}</td>
     <td><div className="button-row account-actions">
      {!showArchivedAccounts&&destinations.length>0&&<button className="button" onClick={()=>{openEntry('transfer');setForm({...newForm(),kind:'transfer',account:a,to:destinations.includes('BOP Savings')?'BOP Savings':destinations[0]})}}>Transfer</button>}
      {!showArchivedAccounts&&a!=='Cash'&&itemStatus(ledger,'account','Cash')==='active'&&<>
       <button className="button" onClick={()=>{openEntry('transfer');setEntryContext('Withdraw cash');setForm({...newForm(),kind:'transfer',description:'Cash withdrawal from '+label,account:a,to:'Cash',category:''})}}>Withdraw cash</button>
       <button className="button" onClick={()=>{openEntry('transfer');setEntryContext('Deposit cash');setForm({...newForm(),kind:'transfer',description:'Cash deposit into '+label,account:'Cash',to:a,category:''})}}>Deposit cash</button>
      </>}
      {!showArchivedAccounts&&<button className="button" onClick={e=>{accountEditorTrigger.current=e.currentTarget;setError('');setBalanceAccount(a)}}>Confirm balance</button>}
      <button className="button account-pencil" aria-label={'Edit '+label} title={'Edit '+label} onClick={e=>{accountEditorTrigger.current=e.currentTarget;setAccountEditor(a)}}><Pencil size={16} aria-hidden="true"/></button>
     </div></td>
    </tr>;
   })}
   </tbody></table></div>
  </section>
  {ledger.entries.some(e=>e.kind==='legacy')&&<p className="section-context">{ledger.confirmedBankAllocation?'Legacy account allocation metadata is retained. Historical spending is unchanged.':'Alfalah and NayaPay history remains combined until allocated.'}</p>}
 </>}
 {page==='people'&&<><div className="stats-grid three"><Stat label="Personal loans owed to you" value={position.receivable}/><Stat label="You owe people" value={position.payable}/><Stat label="Group reimbursements due" value={position.groupReceivable}/></div><PeoplePanel ledger={ledger} onSave={save} onView={e=>setDetailId(e.id)} onGroupPayments={()=>navigate('lunch')} onEntry={(kind,key,amount)=>{if(kind==='groupPayment'){setGroupEditor({payee:key});return}openEntry(kind);const name=personName(ledger,key);setEntryContext(name+' · '+({lend:'I paid for them / lent money',borrow:'They lent me money',repaymentIn:'They paid me back',repaymentOut:'I paid them back',personExpense:'They paid my share',shared:'I paid for both of us'}[kind]||KINDS[kind]));setForm({...newForm(),kind,person:key,category:['personExpense','shared'].includes(kind)?'Food':'',splits:[{person:key,amount:''}],description:kind==='repaymentIn'?'Repayment from '+name:kind==='repaymentOut'?'Repayment to '+name:kind==='personExpense'?name+' paid my share':'',amount:amount==null?'':String(amount/100)})}}/><div className="info-box"><Users size={20}/><p>Personal balances and group reimbursements must all be zero before removal. Settled people with history can be archived; unused people can be deleted. Rename keeps their transaction identity and earlier names.</p></div></>}
 {page==='categories'&&<CategoryPanel ledger={ledger} month={month} onSave={save} onView={e=>setDetailId(e.id)} onAction={(category,kind,title)=>{if(['officeRecovery','merchantRefund'].includes(kind)){setRecoveryEditor({kind,category});return}openEntry(kind);setEntryContext(category+' · '+title);setForm(form=>({...form,kind,category,month}))}}/>}
 {page==='lunch'&&<GroupList ledger={ledger} onNew={()=>setGroupEditor({})} onReceipt={target=>setReceiptEditor(target)} onView={e=>setDetailId(e.id)} onFood={()=>{openEntry('weeklyShare');setEntryContext('Food · My weekly Splitwise share');setForm(form=>({...form,month,account:''}))}}/>}
 {page==='shortcuts'&&<ShortcutsPanel ledger={ledger} onReview={(next,reason)=>setReview({data:next,reason,changes:previewChanges(ledger,next)})} onUse={useShortcut}/>}
 {page==='review'&&<ReviewPanel ledger={ledger} month={month} onEntry={setDetailId} onReview={(next,reason)=>setReview({data:next,reason,changes:previewChanges(ledger,next)})} onFood={(from,to)=>{openEntry('weeklyShare');setForm({...newForm(),kind:'weeklyShare',category:'Food',account:'',month,foodRange:{from,to}});setEntryContext('Food · My Splitwise share')}}/>}
 {page==='reports'&&<ReportsPanel ledger={ledger} month={month} year={year} setMonth={setMonth} setYear={setYear} revision={revision}
  onReview={(next,reason)=>setReview({data:next,reason,changes:previewChanges(ledger,next)})}
  onLink={id=>setParkingLink({id,month})} onView={setDetailId}/>}
 {page==='help'&&<HelpPanel/>}
 {page==='backup'&&<>{desktopHost()&&<AutomaticReports savedAt={savedAt} revision={revision} manual={manualBackup}/>}<section className="panel prose export-panel"><h2>Export your records</h2><p>Save a full JSON backup for recovery. Use Excel for spreadsheets and reporting.</p><label className="check-label"><input type="checkbox" checked={rangeEnabled} onChange={e=>setRangeEnabled(e.target.checked)}/>Export a custom date range</label>{rangeEnabled&&<><label>Filter by<select value={exportRange.basis} onChange={e=>setExportRange({basis:e.target.value as 'actual'|'report',from:'',to:''})}><option value="actual">Actual transaction dates</option><option value="report">Report months</option></select></label><div className="form-grid"><label>From<input required type={exportRange.basis==='actual'?'date':'month'} value={exportRange.from} onChange={e=>setExportRange({...exportRange,from:e.target.value})}/></label><label>Through<input required type={exportRange.basis==='actual'?'date':'month'} value={exportRange.to} onChange={e=>setExportRange({...exportRange,to:e.target.value})}/></label></div><p>A date-range Excel file is a report, not a full backup. It contains only the selected transactions.</p></>}<div className="button-row"><button className="button primary" disabled={exporting} onClick={async()=>{try{setExporting(!!desktopHost());(await import('../lib/excel')).exportExcel(ledger,rangeEnabled?exportRange:undefined)}catch(e){setExporting(false);setError(e instanceof Error?e.message:'Excel export failed.')}}}><Download size={16}/>{rangeEnabled?'Export date-range Excel':'Export full Excel'}</button><button className="button" disabled={exporting} onClick={downloadJSON}>Save full JSON backup</button></div><div className="button-row"><a className="button" href="/setup/">Import into an empty ledger</a>{desktopHost()&&<button className="button" disabled={saving||exporting} onClick={()=>desktopHost()?.postMessage('recover')}>Recover from JSON backup</button>}</div></section><BackupCheck/><section className="panel prose"><h2>Saved history</h2><p>Each successful save retains the previous version. Viewing this list does not replace your ledger.</p>{history.map(h=><p key={h.revision}><strong>{h.reason}</strong> · {new Date(h.created_at).toLocaleString('en-GB')}</p>)}</section><details className="panel prose"><summary>Original Excel comparison</summary><p>{matched} / {checks.length} monthly source comparisons match. This checks the retained original workbook figures, not your later corrections. August onward is the working history; earlier records stay as context.</p></details></>}

 </div></main>
 {balanceAccount&&<BalanceCheck ledger={ledger} account={balanceAccount} today={today()} saving={saving} saveError={error}
  onClose={()=>{setBalanceAccount('');requestAnimationFrame(()=>accountEditorTrigger.current?.focus())}}
  onSave={save} onTransactions={date=>{
   setTransactionAccount(balanceAccount);setSearch('');setDateBasis('actual');setDateFrom(ledger.baselineDate);setDateTo(date);
   setFilter('all');setLimit(50);setBalanceAccount('');navigate('transactions');
  }}/>}
 {accountEditor&&itemStatus(ledger,'account',accountEditor)!=='deleted'&&<div className="modal-overlay"><section className="modal account-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="account-editor-title">
  <div className="modal-heading"><h2 id="account-editor-title">Edit {itemName(ledger,'account',accountEditor)}</h2><button className="account-editor-close" aria-label="Close account settings" disabled={saving} onClick={closeAccountEditor}><X size={21}/></button></div>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <LedgerItemActions key={accountEditor} ledger={ledger} kind="account" itemKey={accountEditor} balance={position.accounts[accountEditor]||0} onSave={async(next,reason)=>{
   const saved=await save(next,reason);if(saved)closeAccountEditor();return saved;
  }}/>
 </section></div>}
 {modal&&<div className="modal-overlay entry-overlay"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="entry-title"><div className="modal-heading"><div><h2 id="entry-title">{editId?'Edit transaction':entryContext||(form.kind==='expense'?'New expense':'New transaction')}</h2></div>{desktopHost()&&!editId&&<button type="button" className="button" onClick={()=>{
   if(savedDraft&&savedDraft.id!==draftId.current&&!window.confirm('Replace the draft you saved earlier?'))return;
   storeDraft();
   finishEntry(true);
  }}>Save for later</button>}<button aria-label="Close entry" onClick={closeEntry}><X size={21}/></button></div><form onSubmit={submit}>{entryContext&&entryContext!=='Duplicate transaction'&&!editId?<div className="guided-choice"><div><small>YOU CHOSE</small><strong>{KINDS[form.kind]}{form.category?' · '+form.category:''}</strong></div><button type="button" className="text-button" onClick={closeEntry}>Change action</button></div>:<>{!editId&&<div className="type-actions" aria-label="Common transaction types">{(['expense','income','transfer'] as const).map(kind=><button className="button" type="button" key={kind} aria-pressed={form.kind===kind} onClick={()=>{setMoreTypes(false);setForm({...form,kind,category:kind==='income'?incomeCategory():form.category==='Salary'?preferredItem(ledger,'category','Food'):form.category})}}>{KINDS[kind]}</button>)}<button className="button" type="button" aria-expanded={moreTypes} onClick={()=>setMoreTypes(!moreTypes)}>More types</button></div>}{(editId||moreTypes||!['expense','income','transfer'].includes(form.kind))&&<label>Transaction type<select required value={form.kind==='legacy'?'legacy:'+form.legacyType:form.kind} onChange={e=>setForm({...form,kind:e.target.value.startsWith('legacy:')?'legacy':e.target.value,...!editId&&e.target.value==='weeklyShare'&&!form.foodRange.to&&{foodRange:nextFoodShareRange(ledger,today())},legacyType:e.target.value.startsWith('legacy:')?e.target.value.slice(7):form.legacyType,to:e.target.value==='adjustment'?'add':form.to,category:e.target.value==='income'?incomeCategory():['splitwiseShare','lunchAdvance','lunchRecovery','splitwiseFunding'].includes(e.target.value)?'Food':form.category})}><option value="" disabled>Choose a transaction type</option>{form.kind==='legacy'?LEGACY_TYPES.map(k=><option key={k} value={'legacy:'+k}>{k}</option>):Object.entries(KINDS).filter(([k])=>!['refund','officeRecovery','merchantRefund','groupPayment','groupReceipt','lunchAdvance','lunchRecovery','splitwiseFunding','splitwiseShare'].includes(k)||form.kind===k).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>}</>}<label>{form.kind==='shared'?'Total paid':'Amount'} · PKR<input className="entry-amount" autoFocus required inputMode="decimal" placeholder="0.00" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label><label>Description<input required maxLength={240} placeholder="What was this for?" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><div className="form-grid">{!['personExpense','splitwiseShare','splitwiseFunding','weeklyShare'].includes(form.kind)&&<label>{form.kind==='transfer'?'From account':form.kind==='expense'?'Paid from':'Account'}<select value={form.account} onChange={e=>setForm({...form,account:e.target.value})}>{(form.kind==='legacy'?Array.from(new Set([form.account,...activeItems(ledger!,'account'),'Current','Savings','Non-cash','Splitwise'])):activeItems(ledger!,'account',...(editId?[form.account]:[]))).map(a=><option key={a} value={a}>{itemName(ledger,'account',a)}</option>)}</select></label>}{['expense','refund','income','personExpense','shared','splitwiseShare','weeklyShare','legacy'].includes(form.kind)&&<label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{(form.kind==='legacy'||!form.category)&&<option value="">{form.kind==='legacy'?'No category':'Choose a category'}</option>}{activeItems(ledger,'category',...(editId?[form.category]:[])).map(c=><option key={c} value={c}>{itemName(ledger,'category',c)}</option>)}</select></label>}</div><div className="form-grid"><label>Actual date<input required type="date" value={form.date} min={form.kind==='legacy'?undefined:ledger.baselineDate} onChange={e=>{const date=e.target.value;setForm({...form,date,month:!editId&&!entryContext&&!monthOverridden&&date?date.slice(0,7):form.month})}}/></label><label>Report month<input required type="month" value={form.month} onChange={e=>{setMonthOverridden(true);setForm({...form,month:e.target.value})}}/></label></div><div className="form-help entry-help">{form.kind==='weeklyShare'?'Enter only your personal food share from Splitwise. This records Food spending without a bank movement, personal loan or group balance.':form.kind==='lend'?'Enter only their share or the amount you lent them. They owe you more; this is not your spending. If you paid for both of you, choose a shared purchase.':form.kind==='borrow'?'Record money this person lent you. Your account increases and you owe them more; it is not income.':form.kind==='repaymentIn'?'Record what they paid back. Your account increases and what they owe you decreases; it is not income. You can enter a partial payment.':form.kind==='repaymentOut'?'Record what you paid back. Your account decreases and your debt decreases; it is not spending. You can enter a partial payment.':form.kind==='transfer'?'Move money between accounts. No income, expense or people effect.':form.kind==='personExpense'?'Records your expense, reduces what this person owes you first, then records any excess as your borrowing.':form.kind==='shared'?'You pay the total. Only your own share is spending; the rest is owed to you.':form.kind==='lunchAdvance'?'Record the full amount you paid the group organizer. It stays an advance until reimbursed or applied as your contribution.':form.kind==='lunchRecovery'?'Receive money from the assigned Splitwise payer. Clears a lunch advance without creating income.':form.kind==='splitwiseShare'?'Enter only your own lunch or roti share from Splitwise. Food spending increases; your bank balance stays unchanged.':form.kind==='splitwiseFunding'?'Apply money you already paid the group organizer as your contribution. No further bank movement or expense.':form.kind==='refund'?'A refund reduces spending in the category and report month you select.':''}</div>{form.kind==='transfer'&&<><p className="form-help">{itemName(ledger,'account',form.account)||'From account'} → {itemName(ledger,'account',form.to)||'To account'}</p><label>To account<select value={form.to} onChange={e=>setForm({...form,to:e.target.value})}>{activeItems(ledger,'account',...(editId?[form.to]:[])).map(a=><option key={a} value={a}>{itemName(ledger,'account',a)}</option>)}</select></label></>}{form.kind==='adjustment'&&<label>Adjustment direction<select value={form.to} onChange={e=>setForm({...form,to:e.target.value})}><option value="add">Increase balance</option><option value="subtract">Decrease balance</option></select></label>}{['lend','borrow','repaymentIn','repaymentOut','personExpense','lunchRecovery','legacy'].includes(form.kind)&&<label>Person {['lunchRecovery','legacy'].includes(form.kind)?'(optional unless loan type)':''}<PersonSelect ledger={ledger} value={form.person} retained={ledger.entries.find(e=>e.id===editId)?.person} onChange={person=>setForm({...form,person})} required={!['lunchRecovery','legacy'].includes(form.kind)}/></label>}
 {form.kind==='weeklyShare'&&<div className="form-grid"><label>Food share covers · from<input required type="date" value={form.foodRange.from} onChange={e=>setForm({...form,foodRange:{...form.foodRange,from:e.target.value}})}/></label><label>Through<input required type="date" value={form.foodRange.to} onChange={e=>setForm({...form,foodRange:{...form.foodRange,to:e.target.value}})}/></label></div>}
 {form.kind==='shared'&&<div className="split-box"><label>Your own share · PKR<input inputMode="decimal" required value={form.ownShare} onChange={e=>setForm({...form,ownShare:e.target.value})}/></label>{form.splits.map((s,i)=><div className="split-row" key={i}><label>Person<PersonSelect ledger={ledger} value={s.person} retained={ledger.entries.find(e=>e.id===editId)?.splits?.[i]?.person} required onChange={person=>setForm({...form,splits:form.splits.map((x,j)=>i===j?{...x,person}:x)})}/></label><label>Share · PKR<input inputMode="decimal" required value={s.amount} onChange={e=>setForm({...form,splits:form.splits.map((x,j)=>i===j?{...x,amount:e.target.value}:x)})}/></label><button type="button" aria-label="Remove split" onClick={()=>setForm({...form,splits:form.splits.filter((_,j)=>i!==j)})}><X size={16}/></button></div>)}<button className="text-button" type="button" onClick={()=>setForm({...form,splits:[...form.splits,{person:'',amount:''}]})}><Plus size={15}/>Add another person</button></div>}
 {form.kind==='legacy'&&<div className="form-help">Original Excel values stay available for comparison. Settlement types move money only; they do not settle a personal loan. Savings transfers select the other account. Original values remain in the Excel comparison.</div>}<label>Notes {form.kind==='adjustment'?'(required)':'(optional)'}<textarea rows={2} maxLength={2000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>{editId&&<label>Reason for correction<input required value={editReason} maxLength={300} onChange={e=>setEditReason(e.target.value)} placeholder="What was wrong, and why is this correct?"/></label>}{form.kind==='expense'&&!editId&&previewAmount(form.amount)>0&&<p className="entry-impact">{itemName(ledger,'account',form.account)} −PKR {money(previewAmount(form.amount))} · {itemName(ledger,'category',form.category)} spending +PKR {money(previewAmount(form.amount))}</p>}{formError&&<div className="form-error" role="alert">{formError}</div>}<div className="modal-footer"><button className="button" type="button" onClick={closeEntry}>Cancel</button><button className="button primary" disabled={saving} type="submit">{saving?'Saving…':!editId&&form.kind==='expense'?'Save expense':'Review changes'}<Check size={16}/></button></div></form></section></div>}

 {deleteId&&<div className="modal-overlay"><section className="modal small-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">Delete this transaction?</h2><p>This is a recoverable deletion. The entry leaves current reports and balances, but its original Excel values and change history remain available.</p><label>Reason for deletion<input autoFocus value={editReason} onChange={e=>setEditReason(e.target.value)} maxLength={300} placeholder="Why should this be removed?"/></label><div className="modal-footer"><button className="button" onClick={()=>setDeleteId(null)}>Cancel</button><button className="button danger-button" data-dialog-submit disabled={saving||!editReason.trim()} onClick={()=>{try{const next=deleteEntry(ledger,deleteId);setReview({data:next,reason:'Transaction deleted: '+editReason.trim(),changes:previewChanges(ledger,next)})}catch(e){setError(e instanceof Error?e.message:'A later transaction depends on this entry.');setDeleteId(null)}}}>Review deletion</button></div></section></div>}
 {detailId&&ledger.entries.find(e=>e.id===detailId)&&<Details onRelated={setDetailId} onParkingLinks={()=>{const e=ledger.entries.find(x=>x.id===detailId)!;setParkingLink({id:e.id,month:e.parking?.allocations[0]?.month||month});setDetailId(null)}} onShortcut={()=>{try{const e=ledger.entries.find(x=>x.id===detailId)!;const shortcut=shortcutFromEntry(e);setReview({data:{...ledger,shortcuts:[...(ledger.shortcuts||[]),shortcut]},reason:'Shortcut saved: '+shortcut.name,changes:[]})}catch(err){setError(err instanceof Error?err.message:'Choose a simple expense, income or transfer.')}}} onExistingRefund={()=>{setExistingRefund({refundId:detailId});setDetailId(null)}} onRecovery={kind=>{setRecoveryEditor({kind,expenseId:detailId});setDetailId(null)}} onGroupReceipt={target=>{setDetailId(null);setReceiptEditor(target)}} entry={ledger.entries.find(e=>e.id===detailId)!} ledger={ledger} onClose={()=>setDetailId(null)} onEdit={()=>edit(ledger.entries.find(e=>e.id===detailId)!)} onDuplicate={()=>duplicate(ledger.entries.find(e=>e.id===detailId)!)} onDelete={()=>{setDeleteId(detailId);setDetailId(null);setEditReason('')}} onRestore={()=>{try{const e=ledger.entries.find(x=>x.id===detailId)!;const restored={...e,deleted:false};const next=reflow({...ledger,entries:ledger.entries.map(x=>x.id===e.id?restored:x)});setReview({data:next,reason:'Deleted transaction restored',changes:previewChanges(ledger,next)})}catch(e){setError(e instanceof Error?e.message:'Could not restore entry.')}}}/>}
 {parkingLink&&<ParkingLinkEditor ledger={ledger} month={parkingLink.month} entryId={parkingLink.id} onClose={()=>setParkingLink(null)} onReview={(next,reason)=>setReview({data:next,reason,changes:previewChanges(ledger,next)})}/>}
 {existingRefund&&<ExistingRefundEditor ledger={ledger} refundId={existingRefund.refundId} expenseId={existingRefund.expenseId} onClose={()=>setExistingRefund(null)} onReview={(next,reason)=>setReview({data:next,reason,changes:previewChanges(ledger,next)})}/>}
 {recoveryEditor&&<RecoveryEditor onExistingRefund={(refundId,expenseId)=>{setRecoveryEditor(null);setExistingRefund({refundId,expenseId})}} ledger={ledger} kind={recoveryEditor.kind} defaultCategory={recoveryEditor.category} expenseId={recoveryEditor.expenseId} entry={ledger.entries.find(e=>e.id===recoveryEditor.editId)} onClose={()=>setRecoveryEditor(null)} onReview={(next,reason)=>setReview({data:next,reason,changes:previewChanges(ledger,next)})}/>}
 {groupEditor&&<GroupEditor ledger={ledger} payee={groupEditor.payee} entry={ledger.entries.find(e=>e.id===groupEditor.editId)} onClose={()=>setGroupEditor(null)} onReview={(next,reason)=>setReview({data:next,reason,changes:previewChanges(ledger,next)})}/>}
 {receiptEditor&&<ReceiptEditor ledger={ledger} target={receiptEditor} onClose={()=>setReceiptEditor(null)} onReview={(next,reason)=>setReview({data:next,reason,changes:previewChanges(ledger,next)})}/>}
 {review&&<div className="modal-overlay review-overlay"><section className="modal details-modal" role="dialog" aria-modal="true" aria-labelledby="review-title"><div className="modal-heading"><h2 id="review-title" tabIndex={-1}>Review changes</h2><button data-dialog-close aria-label="Close change preview" onClick={()=>setReview(null)}><X size={20}/></button></div><p className="muted-paragraph">{review.reason}</p>{entryWarnings(ledger,review.data,today()).map(warning=><div className="form-error" key={warning}>{warning} Check the amount or date before confirming.</div>)}{error&&<div role="alert" className="form-error">{error}</div>}{reviewData(review.data).checkpoints.filter(c=>checkpointView(review.data,c).needsRecheck&&!checkpointView(ledger,c).needsRecheck).map(c=><div className="form-error" key={c.id}>This change affects the {c.account} checkpoint on {c.date}. It will need rechecking.</div>)}{duplicatePairs(review.data,new Set(review.data.entries.filter(e=>JSON.stringify(e)!==JSON.stringify(ledger.entries.find(x=>x.id===e.id))).map(e=>e.id))).map(pair=><div className="info-box" key={pair.key}><div><strong>Possible duplicate</strong><p>{pair.reason}</p><p>{[pair.a,pair.b].map((entry,index)=><span key={entry.id}>{index>0&&<br/>}{entry.date} · PKR {money(entry.amount)} · {itemName(ledger,'account',entry.account)||'Non-cash'} · {entry.description}</span>)}</p><button className="button" onClick={()=>setReview({...review,data:updateReview(review.data,{duplicateAcknowledgements:[...reviewData(review.data).duplicateAcknowledgements,pair.key]})})}>Both are real</button><p>You can go Back to check. Saving keeps both entries.</p></div></div>)}<ParkingChanges before={ledger} after={review.data}/><ShortcutChanges before={ledger} after={review.data}/><RefundLinkChanges before={ledger} after={review.data}/><ReviewMetadataChanges before={ledger} after={review.data}/><RecordedTogether before={ledger} after={review.data}/><Changes changes={review.changes}/><div className="modal-footer"><button className="button" disabled={saving} onClick={()=>setReview(null)}>Back</button><button className="button primary" data-dialog-submit aria-keyshortcuts="Enter Control+Enter" disabled={saving} onClick={async()=>{if(await save(review.data,review.reason)){setReview(null);if(modal)finishEntry();setDeleteId(null);setDetailId(null);setGroupEditor(null);setReceiptEditor(null);setRecoveryEditor(null);setExistingRefund(null);setParkingLink(null)}}}>{saving?'Saving…':'Confirm and save'}</button></div></section></div>}

 </div>
}

