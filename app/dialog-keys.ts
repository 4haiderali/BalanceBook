export function handleDialogKey(e:KeyboardEvent,busy:boolean){
if((e.key==='Escape'||e.key==='Enter')&&!e.defaultPrevented&&!e.isComposing){
 // The person dialog stays mounted underneath transaction details.
 const overlays=document.querySelectorAll<HTMLElement>('.modal-overlay');
 let top:HTMLElement|undefined;
 let z=-Infinity;
 for(const overlay of overlays){
  const layer=Number(getComputedStyle(overlay).zIndex)||0;
  if(layer>=z){top=overlay;z=layer}
 }
 if(e.key==='Escape'&&!e.repeat){
  const close=top?.querySelector<HTMLButtonElement>('[data-dialog-close],.people-dialog-close,.account-editor-close,.group-dialog-close');
  if(close&&!close.disabled){e.preventDefault();close.click();return true}
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

