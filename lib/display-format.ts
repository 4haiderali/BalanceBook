const compactMoney=new Intl.NumberFormat('en-PK',{maximumFractionDigits:2});
const fixedMoney=new Intl.NumberFormat('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2});
export const formatMoney=(cents:number)=>compactMoney.format(cents/100);
export const formatExactMoney=(cents:number)=>fixedMoney.format(cents/100);
export const monthName=(v:string)=>new Date(v+'-01T00:00:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'});

// One currency label and one date style for everything the person reads in the app.
// (Native date pickers follow Windows' own regional format and are not affected.)
export const CURRENCY='PKR';
export const formatCurrency=(cents:number)=>`${CURRENCY} ${formatMoney(cents)}`;
const dateOnly=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
// "2026-11-21" -> "21 Nov 2026". Anything that is not a plain date is returned unchanged.
export const formatDate=(iso:string)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return iso;
  const date=new Date(iso+'T00:00:00Z');
  return Number.isNaN(date.getTime())?iso:dateOnly.format(date);
};
const dateTime=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Karachi'});
// A saved/checked timestamp -> "21 Nov 2026, 23:06" in Pakistan time, matching today() in the app.
export const formatDateTime=(value:string|number|Date)=>{
  const date=new Date(value);
  return Number.isNaN(date.getTime())?String(value):dateTime.format(date);
};
