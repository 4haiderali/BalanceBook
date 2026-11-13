export function parseAmount(input:string,signed=false):number{
 const value=input.trim();
 const match=/^(-?)(\d+|\d{1,3}(?:,\d{3})+)?(?:\.(\d{0,2}))?$/.exec(value);
 if(!match||(!match[2]&&!match[3])||(!signed&&match[1]))
  throw Error('Enter a valid amount with up to two decimal places.');
 const digits=(match[2]||'0').replaceAll(',','')+(match[3]||'').padEnd(2,'0');
 const cents=Number(digits);
 if(!Number.isSafeInteger(cents))throw Error('This amount is too large to store exactly.');
 return match[1]?-cents:cents;
}
export function previewAmount(input:string){
 try{return parseAmount(input)}catch{return 0}
}
