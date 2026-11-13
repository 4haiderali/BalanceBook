import {accountNames} from './accounts';
import {categoryNames} from './categories';
import {totals,type Entry,type Ledger} from './ledger';

export type ItemKind='account'|'category';
export type ItemSettings=Record<string,{name?:string;status?:'archived'|'deleted'}>;
type Action='rename'|'archive'|'restore'|'delete';

const settingsKey=(kind:ItemKind)=>kind==='account'?'accountSettings':'categorySettings';
const itemKeys=(ledger:Ledger,kind:ItemKind)=>kind==='account'?accountNames(ledger):categoryNames(ledger);
const clean=(value:string)=>value.trim().replace(/\s+/g,' ');
const keyOf=(value:string)=>clean(value).toLowerCase();

export function itemName(ledger:Ledger,kind:ItemKind,key:string){
 return ledger[settingsKey(kind)]?.[key]?.name||key;
}
export function itemStatus(ledger:Ledger,kind:ItemKind,key:string){
 return ledger[settingsKey(kind)]?.[key]?.status||'active';
}
export function activeItems(ledger:Ledger,kind:ItemKind,...retained:string[]){
 return [...new Set([...itemKeys(ledger,kind).filter(key=>itemStatus(ledger,kind,key)==='active'),...retained.filter(Boolean)])];
}

export function preferredItem(ledger:Ledger,kind:ItemKind,key:string){
 const items=activeItems(ledger,kind);
 return items.includes(key)?key:items[0]||'';
}

function entryUses(entry:Partial<Entry>|null|undefined,kind:ItemKind,key:string):boolean{
 if(!entry)return false;
 if(kind==='account'){
  if(entry.account===key||entry.to===key||Object.hasOwn(entry.effects?.accounts||{},key))return true;
 }else if(entry.category===key||Object.hasOwn(entry.effects?.spendByCategory||{},key)||entry.recoveries?.some(part=>part.category===key))return true;
 return !!entry.original&&entryUses(entry.original,kind,key);
}
export function itemHasHistory(ledger:Ledger,kind:ItemKind,key:string){
 return ledger.entries.some(e=>entryUses(e,kind,key))
  || !!ledger.audit?.some(record=>entryUses(record.before,kind,key)||entryUses(record.after,kind,key))
  || (kind==='account'&&(!!ledger.openings[key]||!!ledger.sourceOpenings?.[key]||!!ledger.review?.checkpoints.some(c=>c.account===key)));
}
function shortcutUses(ledger:Ledger,kind:ItemKind,key:string){
 return !!ledger.shortcuts?.some(s=>kind==='account'?s.account===key||s.to===key:s.category===key);
}
export function checkItemName(ledger:Ledger,kind:ItemKind,input:string,except?:string){
 const name=clean(input),comparison=keyOf(name);
 const reserved=kind==='account'?['Current','Savings','Non-cash','Splitwise',...(except==='Legacy Current'?[]:['Legacy Current'])]:['Multiple categories'];
 if(!name||name.length>60||['__proto__','constructor','prototype',...reserved].some(key=>keyOf(key)===comparison))
  throw Error('Enter a valid '+kind+' name up to 60 characters.');
 if(itemKeys(ledger,kind).some(key=>key!==except&&(
  keyOf(key)===comparison||keyOf(itemName(ledger,kind,key))===comparison
 )))
  throw Error('That '+kind+' name is already in use.');
 return name;
}
export function manageLedgerItem(ledger:Ledger,kind:ItemKind,key:string,action:Action,input=''):Ledger{
 if(!itemKeys(ledger,kind).includes(key)||itemStatus(ledger,kind,key)==='deleted')throw Error('Item not found.');
 const field=settingsKey(kind),item={...ledger[field]?.[key]};
 if(action==='rename')item.name=checkItemName(ledger,kind,input,key);
 if(action==='archive'){
  if(kind==='account'&&totals(ledger).accounts[key])throw Error('An account must have a zero balance before it can be archived.');
  item.status='archived';
 }
 if(action==='restore')delete item.status;
 if(action==='delete'){
  if(itemHasHistory(ledger,kind,key))throw Error('This '+kind+' has history and can only be archived.');
  if(shortcutUses(ledger,kind,key))throw Error('Change the saved shortcuts that use this '+kind+' before deleting it.');
  return {...ledger,[field]:{...ledger[field],[key]:{status:'deleted'}}};
 }
 return {...ledger,[field]:{...ledger[field],[key]:item}};
}
export function validateLedgerItems(ledger:Ledger){
 const balances=ledger.accountSettings?totals(ledger).accounts:{};
 for(const kind of ['account','category'] as const){
  const settings=ledger[settingsKey(kind)];
  if(settings===undefined)continue;
  if(!settings||typeof settings!=='object'||Array.isArray(settings))throw Error('Invalid '+kind+' settings.');
  for(const [key,item] of Object.entries(settings)){
   if(!itemKeys(ledger,kind).includes(key)||!item||typeof item!=='object'||Array.isArray(item)
     ||(item.status!==undefined&&!['archived','deleted'].includes(item.status)))throw Error('Invalid '+kind+' settings.');
   if(item.name!==undefined){
    if(typeof item.name!=='string')throw Error('Invalid '+kind+' name.');
    checkItemName(ledger,kind,item.name,key);
   }
   if(item.status==='deleted'&&(itemHasHistory(ledger,kind,key)||shortcutUses(ledger,kind,key)))
    throw Error('Keep '+kind+' history and shortcut references.');
   if(kind==='account'&&item.status==='archived'&&balances[key])throw Error('An archived account must have a zero balance.');
  }
 }
}
export function checkActiveEntryItems(ledger:Ledger,entry:Entry,before?:Entry){
 for(const kind of ['account','category'] as const){
  for(const key of Object.keys(ledger[settingsKey(kind)]||{})){
   if(itemStatus(ledger,kind,key)!=='active'&&entryUses(entry,kind,key)&&(!before||before.deleted||!entryUses(before,kind,key)))
    throw Error('Restore '+itemName(ledger,kind,key)+' before using it in a new transaction.');
  }
 }
}
