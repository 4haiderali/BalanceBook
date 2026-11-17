import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {handleDialogKey} from '../app/dialog-keys.ts';
const dom=new JSDOM('<body></body>');
const {window}=dom;
globalThis.document=window.document;
globalThis.Element=window.Element;
globalThis.getComputedStyle=window.getComputedStyle.bind(window);
function overlay(layer,marked=true){
 const el=document.createElement('div');el.className='modal-overlay';el.style.zIndex=String(layer);
 el.getClientRects=()=>[{width:100,height:100}];
 const close=document.createElement('button');close.type='button';if(marked)close.dataset.dialogClose='';
 el.append(close);document.body.append(el);return {el,close};
}
function escape(options={},busy=false){const e=new window.KeyboardEvent('keydown',{key:'Escape',cancelable:true,...options});return {handled:handleDialogKey(e,busy),prevented:e.defaultPrevented};}
// User-reported sequence: child closes, then Escape must close its parent.
let first=0,second=0;
const parent=overlay(60),child=overlay(70);
parent.close.onclick=()=>{first++;parent.el.remove()};child.close.onclick=()=>{second++;child.el.remove()};
assert.equal(escape().handled,true);assert.equal(second,1);assert.equal(first,0);
assert.equal(escape().handled,true);assert.equal(first,1);
// CSS stacking wins over DOM order; hidden dialogs are skipped.
const review=overlay(80),under=overlay(65),hidden=overlay(100);hidden.el.getClientRects=()=>[];
let calls=0;review.close.onclick=()=>calls++;under.close.onclick=()=>assert.fail('Closed underlying dialog');
assert.equal(escape().handled,true);assert.equal(calls,1);
assert.equal(escape({repeat:true}).handled,true);assert.equal(calls,1);
assert.equal(escape({},true).handled,true);assert.equal(calls,1);
review.close.disabled=true;assert.equal(escape().handled,true);assert.equal(calls,1);
review.el.remove();hidden.el.remove();under.el.remove();
// An unclosable top overlay must consume Escape, never leak to a lower draft.
const lower=overlay(60),upper=overlay(70,false);lower.close.onclick=()=>assert.fail('Leaked Escape');
assert.deepEqual(escape(),{handled:true,prevented:true});document.body.replaceChildren();
// The normal close callback owns unsaved-work handling; cancellation retains the draft.
const draft=overlay(65);let draftChecks=0;draft.close.onclick=()=>{draftChecks++};
escape();assert.equal(draftChecks,1);assert.ok(draft.el.isConnected);
const composed=escape({isComposing:true});assert.equal(composed.handled,false);assert.equal(draftChecks,1);
document.body.replaceChildren();assert.equal(escape().handled,false);
// Ensure all actual overlays expose a close marker, including footer-only dialogs.
for(const file of ['balance-check','category-panel','existing-refund-editor','group-payments','money-app','month-end','recovery-editor','shortcuts-panel','v2-panels']){
 const source=readFileSync(new URL(`../app/${file}.tsx`,import.meta.url),'utf8');
 const chunks=source.split(/<div className="modal-overlay[^\"]*">/).slice(1);
 for(const chunk of chunks)assert.match(chunk.split('</section></div>')[0],/data-dialog-close/,`${file}: missing registered close`);
}
console.log('PASS dialog keys: child then parent, CSS stacking, hidden layers, repeats, busy/disabled, blocked fallthrough, draft callback and all overlay close registrations.');
