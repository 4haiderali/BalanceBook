const compactMoney=new Intl.NumberFormat('en-PK',{maximumFractionDigits:2});
const fixedMoney=new Intl.NumberFormat('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2});
export const formatMoney=(cents:number)=>compactMoney.format(cents/100);
export const formatExactMoney=(cents:number)=>fixedMoney.format(cents/100);
export const monthName=(v:string)=>new Date(v+'-01T00:00:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'});
