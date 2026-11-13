import {checkItemName,itemStatus} from './ledger-items';
import {ACCOUNTS,totals,reflow,emptyEffects,type Ledger,type Entry} from './ledger.ts';
export const accountNames=(l:Ledger)=>[...ACCOUNTS,...(l.extraAccounts||[])].filter(a=>a!=='Legacy Current'||!l.tailoringVersion);
export function addAccount(l:Ledger,input:string,type:AccountType='current'):Ledger{
 const existing=accountNames(l).find(key=>key.toLowerCase()===input.trim().replace(/\s+/g,' ').toLowerCase());
 const reuse=existing&&itemStatus(l,'account',existing)==='deleted'?existing:undefined;
 const name=checkItemName(l,'account',input,reuse),key=reuse||name;
 return {...l,...reuse&&{accountSettings:{...l.accountSettings,[key]:{name}}},
  accountTypes:{...l.accountTypes,[key]:type},extraAccounts:reuse?l.extraAccounts:[...(l.extraAccounts||[]),key],openings:{...l.openings,[key]:0}};
}
export type AccountType='current'|'savings'|'wallet'|'cash';
export function accountType(l:Ledger,name:string):AccountType{return l.accountTypes?.[name]||(name==='BOP Savings'?'savings':name==='Cash'?'cash':name==='NayaPay'?'wallet':'current')}
