import {checkItemName,itemStatus} from './ledger-items';
import {CATEGORIES,type Ledger} from './ledger.ts';
export const categoryNames=(l:Ledger)=>[...new Set([...CATEGORIES,...(l.extraCategories||[]),...l.entries.flatMap(e=>[e.category,...Object.keys(e.effects.spendByCategory||{}),...(e.recoveries||[]).map(part=>part.category)]).filter(c=>c&&c!=='Multiple categories')])];
export const categoryType=(l:Ledger,c:string)=>l.categoryTypes?.[c]||(c==='Salary'?'income':'expense');
export const CATEGORY_ICONS=['tag','food','grocery','home','car','fuel','shopping','health','person','charity','gift','bills','salary','education','travel','entertainment','family','pets','work','savings'] as const;
export type CategoryIcon=typeof CATEGORY_ICONS[number];

const DEFAULT_CATEGORY_ICONS=new Map<string,CategoryIcon>([
 ['Food','food'],['Grocery','grocery'],['Rent','home'],['Transport','car'],['Fuel','fuel'],
 ['Shopping','shopping'],['Health','health'],['Personal','person'],['Charity','charity'],
 ['Gifts','gift'],['Bills','bills'],['Salary','salary'],
]);
const LEGACY_TAG_ICONS=new Map<string,CategoryIcon>([
 ['Food','food'],['Groceries','grocery'],['Transport','car'],['Home','home'],['Utilities','bills'],
 ['Shopping','shopping'],['Health','health'],['Education','education'],['Travel','travel'],
 ['Entertainment','entertainment'],['Family','family'],['Pets','pets'],['Gifts','gift'],
 ['Work','work'],['Salary','salary'],['Savings','savings'],['Other','tag'],
]);

export function categoryIcon(ledger:Ledger,key:string):CategoryIcon{
 const settings=ledger.categorySettings?.[key];
 return settings?.icon??DEFAULT_CATEGORY_ICONS.get(key)??LEGACY_TAG_ICONS.get(settings?.tag??'')??'tag';
}

export function setCategoryIcon(ledger:Ledger,key:string,icon:CategoryIcon):Ledger{
 if(!categoryNames(ledger).includes(key)||itemStatus(ledger,'category',key)==='deleted')throw Error('Category not found.');
 return {...ledger,categorySettings:{...ledger.categorySettings,[key]:{...ledger.categorySettings?.[key],icon}}};
}

export function addCategory(l:Ledger,input:string,type:'income'|'expense'='expense',icon?:CategoryIcon):Ledger{
 const existing=categoryNames(l).find(key=>key.toLowerCase()===input.trim().replace(/\s+/g,' ').toLowerCase());
 const reuse=existing&&itemStatus(l,'category',existing)==='deleted'?existing:undefined;
 const name=checkItemName(l,'category',input,reuse),key=reuse||name;
 return {...l,...(reuse||icon!==undefined)&&{categorySettings:{...l.categorySettings,[key]:{...reuse&&{name},...icon!==undefined&&{icon}}}},
  extraCategories:reuse?l.extraCategories:[...(l.extraCategories||[]),key],categoryTypes:{...l.categoryTypes,[key]:type}};
}
