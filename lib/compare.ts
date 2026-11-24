import {formatCurrency} from './display-format';

export function previousMonth(month:string):string{
 const [year,number]=month.split('-').map(Number);
 return number===1
  ?String(year-1).padStart(4,'0')+'-12'
  :month.slice(0,5)+String(number-1).padStart(2,'0');
}

export function delta(current:number,previous:number):{amount:number;percent:number|null}{
 const amount=current-previous;
 return {amount,percent:previous===0?null:amount/Math.abs(previous)*100};
}

const percentFormat=new Intl.NumberFormat('en-PK',{style:'percent',maximumFractionDigits:1});

export function describeDelta(current:number,previous:number,period:string):string{
 const {amount,percent}=delta(current,previous);
 if(amount===0)return 'Same as '+period;
 const change=percent===null?formatCurrency(Math.abs(amount)):percentFormat.format(Math.abs(percent)/100);
 return change+(amount<0?' lower than ':' higher than ')+period;
}
