import {ACCOUNTS,CATEGORIES,validateLedger,type Ledger} from './ledger';
// No workbook, personal names or historical balances for a new identity.
export function emptyLedger(date=new Date().toISOString().slice(0,10)):Ledger{return validateLedger({version:1,tailoringVersion:7,baselineDate:date,openings:{Cash:0},openingPeople:{},entries:[],reference:[],sourceName:'New empty ledger',includeSplitwise:false,splitwiseOpening:0,splitwiseOpeningDate:date,accountStatus:'Add your own verified opening balances before daily use.'})}

export function newDesktopLedger():Ledger{
 const ledger=emptyLedger();
 const starterCategories=new Set(['Food','Transport','Bills','Shopping','Health','Misc','Salary']);
 return {
  ...ledger,
  openings:{Cash:0},
  accountSettings:Object.fromEntries(ACCOUNTS.filter(key=>key!=='Cash'&&key!=='Legacy Current').map(key=>[key,{status:'deleted'}])),
  categorySettings:Object.fromEntries(CATEGORIES.filter(key=>!starterCategories.has(key)).map(key=>[key,{status:'deleted'}])),
 };
}
