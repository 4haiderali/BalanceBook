import {KARACHI_TIME_ZONE} from './dates';

export const CURRENCY='PKR';
export const DISPLAY_OPTIONS={
 dateStyle:['short','slash','iso'],
 currency:[CURRENCY,'Rs','none'],
 grouping:['international','south-asian'],
 decimals:['auto','always'],
} as const;
export type DisplayPreferences={-readonly [K in keyof typeof DISPLAY_OPTIONS]:typeof DISPLAY_OPTIONS[K][number]};
export const DEFAULT_DISPLAY:Readonly<DisplayPreferences>=Object.freeze({dateStyle:'short',currency:CURRENCY,grouping:'international',decimals:'auto'});

function option<T extends string>(value:unknown,allowed:readonly T[],fallback:T):T{
 return allowed.find(candidate=>candidate===value)??fallback;
}

export function validateDisplayPreferences(value:unknown):DisplayPreferences{
 const stored=(value??{}) as Partial<DisplayPreferences>;
 return {
  dateStyle:option(stored.dateStyle,DISPLAY_OPTIONS.dateStyle,DEFAULT_DISPLAY.dateStyle),
  currency:option(stored.currency,DISPLAY_OPTIONS.currency,DEFAULT_DISPLAY.currency),
  grouping:option(stored.grouping,DISPLAY_OPTIONS.grouping,DEFAULT_DISPLAY.grouping),
  decimals:option(stored.decimals,DISPLAY_OPTIONS.decimals,DEFAULT_DISPLAY.decimals),
 };
}

let preferences=validateDisplayPreferences(DEFAULT_DISPLAY);
export function setDisplayPreferences(value:unknown){preferences=validateDisplayPreferences(value)}
const numberFormats=Object.fromEntries(DISPLAY_OPTIONS.grouping.map(grouping=>{
 const locale=grouping==='south-asian'?'en-IN':'en-US';
 return [grouping,{
  auto:new Intl.NumberFormat(locale,{maximumFractionDigits:2}),
  always:new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2}),
 }];
}));
export const currencyLabel=()=>preferences.currency==='none'?'':preferences.currency;
export const currencyAffix=(before:string,after='')=>currencyLabel()?before+currencyLabel()+after:'';
export const formatMoney=(cents:number)=>numberFormats[preferences.grouping][preferences.decimals==='always'||cents%100!==0?'always':'auto'].format(cents/100);
export const formatExactMoney=(cents:number)=>numberFormats[preferences.grouping].always.format(cents/100);
export const formatCurrency=(cents:number)=>currencyAffix('',' ')+formatMoney(cents);
export const formatExactCurrency=(cents:number)=>currencyAffix('',' ')+formatExactMoney(cents);
const numericDateTime=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:KARACHI_TIME_ZONE});

export const monthName=(v:string)=>new Date(v+'-01T00:00:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'});

const dateOnly=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
// "2026-11-21" -> "21 Nov 2026". Anything that is not a plain date is returned unchanged.
export const formatDate=(iso:string)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return iso;
  const date=new Date(iso+'T00:00:00Z');
  if(Number.isNaN(date.getTime()))return iso;
  if(preferences.dateStyle==='iso')return iso;
  if(preferences.dateStyle==='slash')return iso.split('-').reverse().join('/');
  return dateOnly.format(date).replace(/\bSept\b/,'Sep');
};
const dateTime=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:KARACHI_TIME_ZONE});
// A saved/checked timestamp -> "21 Nov 2026, 23:06" in Pakistan time, matching today() in the app.
export const formatDateTime=(value:string|number|Date)=>{
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return String(value);
  if(preferences.dateStyle==='short')return dateTime.format(date).replace(/\bSept\b/,'Sep');
  const parts=Object.fromEntries(numericDateTime.formatToParts(date).map(({type,value})=>[type,value]));
  const time=parts.hour+':'+parts.minute;
  return preferences.dateStyle==='iso'
    ?[parts.year,parts.month,parts.day].join('-')+' '+time
    :[parts.day,parts.month,parts.year].join('/')+', '+time;
};
