function topDialog(){
 let top:HTMLElement|undefined;
 let z=-Infinity;
 for(const overlay of document.querySelectorAll<HTMLElement>('.modal-overlay')){
  if(!overlay.getClientRects().length)continue;
  const layer=Number(getComputedStyle(overlay).zIndex)||0;
  if(layer>=z){top=overlay.querySelector<HTMLElement>('.modal')??overlay;z=layer}
 }
 return top;
}

const controlSelector='button,input:not([type=hidden]),select,textarea,summary,a[href],[tabindex],[contenteditable=true]';
function controls(dialog:HTMLElement){
 return Array.from(dialog.querySelectorAll<HTMLElement>(controlSelector))
  .filter(el=>el.tabIndex>=0&&!el.matches(':disabled')&&el.getClientRects().length&&getComputedStyle(el).visibility==='visible');
}

function focusDialog(dialog:HTMLElement){
 const title=document.getElementById(dialog.getAttribute('aria-labelledby')||'');
 if(title&&dialog.contains(title)){
  title.tabIndex=-1;
  title.focus({preventScroll:true});
 }else controls(dialog)[0]?.focus();
}

export function manageDialogFocus(){
 const returnTargets=new WeakMap<HTMLElement,{opener:HTMLElement;parent?:HTMLElement}>();
 const covered=new Set<HTMLElement>();
 let current:HTMLElement|undefined;
 let lastTarget:HTMLElement|undefined=document.activeElement instanceof HTMLElement?document.activeElement:undefined;
 function sync(){
  const next=topDialog();
  if(next===current)return;
  const previous=current;
  current=next;
  if(next&&covered.delete(next))next.inert=false;
  const closing=previous&&!previous.isConnected;
  let target=closing?returnTargets.get(previous):undefined;
  while(target?.parent&&!target.parent.isConnected)target=returnTargets.get(target.parent);
  const restore=target?.opener;
  if(next&&!returnTargets.has(next)){
   const opener=restore??lastTarget;
   if(opener&&!next.contains(opener))returnTargets.set(next,{opener,parent:opener.closest<HTMLElement>('.modal')??undefined});
  }
  if(next&&previous?.isConnected&&!previous.contains(next)&&!next.contains(previous)&&!previous.inert){
   previous.inert=true;
   covered.add(previous);
  }
  for(const dialog of covered)if(!dialog.isConnected)covered.delete(dialog);
  if(restore?.isConnected&&(!next||next.contains(restore))){
   restore.focus({preventScroll:true});
  }
  if(next&&!next.contains(document.activeElement))focusDialog(next);
 }
 function remember(event:Event){
  const element=event.target instanceof Element?event.target.closest<HTMLElement>(controlSelector):null;
  if(!element||element.closest('[data-slot=popover-content]'))return;
  if(!current||current.contains(element))lastTarget=element;
 }
 function trap(event:FocusEvent){
  if(current&&current.isConnected&&event.target instanceof Element&&
     !current.contains(event.target)&&!event.target.closest('[data-slot=popover-content], [data-radix-focus-guard]')&&
     topDialog()===current){
   focusDialog(current);
   return;
  }
  // React may autofocus a newly mounted dialog before the observer runs.
  if(!current&&event.target instanceof Element&&event.target.closest('.modal'))return;
  remember(event);
 }
 const observer=new MutationObserver(sync);
 observer.observe(document.body,{childList:true,subtree:true});
 document.addEventListener('pointerdown',remember,true);
 document.addEventListener('focusin',trap);
 sync();
 return ()=>{
  observer.disconnect();
  for(const dialog of covered)dialog.inert=false;
  document.removeEventListener('pointerdown',remember,true);
  document.removeEventListener('focusin',trap);
 };
}

export function handleDialogKey(e:KeyboardEvent,busy:boolean){
if(e.defaultPrevented||e.isComposing)return false;
 const target=e.target instanceof Element?e.target:null;
 const top=topDialog();
 if(target?.closest('[data-slot=popover-content]'))return true;
 if(e.key==='Tab'&&top){
  const items=controls(top);
  const first=items[0],last=items.at(-1);
  const active=document.activeElement;
  if(!items.length||!top.contains(active)||(e.shiftKey&&(!items.includes(active as HTMLElement)||active===first))||(!e.shiftKey&&active===last)){
   e.preventDefault();
   (e.shiftKey?last:first)?.focus();
  }
  return true;
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
 return !!top;
}

