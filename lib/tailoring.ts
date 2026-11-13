import {type Ledger} from './ledger';
// Historical identity mappings are intentionally not part of the public app.
export function isDebtPerson(l:Ledger,key:string){const p=l.people?.find(p=>p.key===key);if(p?.mergedInto||p?.notPerson)return false;if(p?.manual)return true;return l.entries.some(e=>Object.entries(e.effects.receivable).some(([k,v])=>k===key&&v!==0)||Object.entries(e.effects.payable).some(([k,v])=>k===key&&v!==0)||e.splits?.some(s=>s.person===key)||e.group?.assignments.some(a=>a.person===key))||!!l.openingPeople[key]?.receivable||!!l.openingPeople[key]?.payable}
