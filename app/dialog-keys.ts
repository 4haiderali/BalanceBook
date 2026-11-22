export function handleDialogKey(e:KeyboardEvent,busy:boolean){
if((e.key==='Escape'||e.key==='Enter')&&!e.defaultPrevented&&!e.isComposing){
 // The person dialog stays mounted underneath transaction details.
 const overlays=document.querySelectorAll<HTMLElement>('.modal-overlay');
 let top:HTMLElement|undefined;
 let z=-Infinity;
 for(const overlay of overlays){
  if(!overlay.getClientRects().length)continue;
  const layer=Number(getComputedStyle(overlay).zIndex)||0;
  if(layer>=z){top=overlay;z=layer}
 }
 if(e.key==='Escape'&&top){
  // One key press belongs to one overlay, even when it cannot close yet.
  // Reuse its normal close action so draft confirmation is preserved.
  e.preventDefault();
  const close=top.querySelector<HTMLButtonElement>('button[data-dialog-close]');
  if(!e.repeat&&!busy&&close&&!close.disabled)close.click();
  return true;
 }
 if(e.key==='Enter'&&top&&!e.altKey&&!e.metaKey&&!e.shiftKey){
  const target=e.target instanceof Element?e.target:null;
  const nativeControl=target?.closest('button,a[href],select,textarea,summary,[contenteditable=true],input[type=checkbox],input[type=radio]');
  if(e.ctrlKey||!nativeControl||!top.contains(nativeControl)){
   const marked=top.querySelector<HTMLButtonElement>('button[data-dialog-submit]');
   const submit=marked||Array.from(top.querySelectorAll<HTMLButtonElement>('form button.primary')).find(button=>button.type==='submit');
   if(submit){
    e.preventDefault();
    if(!e.repeat&&!submit.disabled&&!busy){
     if(submit.form)submit.form.requestSubmit(submit);
     else submit.click();
    }
    return true;
   }
  }
 }
}
 return false;
}

