import assert from 'node:assert/strict';
import {addAccount} from '../lib/accounts.ts';
import {addCategory} from '../lib/categories.ts';
import {emptyLedger} from '../lib/empty-ledger.ts';
import {activeItems,itemName,itemStatus,manageLedgerItem} from '../lib/ledger-items.ts';
import {emptyEffects,totals} from '../lib/ledger.ts';
import {checkTransition,prepareEntry,validateState} from '../lib/v2.ts';
import {createBackup,verifyBackup} from '../lib/backup.ts';

const seed=emptyLedger('2026-01-01');
const entry={id:'sample',date:'2026-01-02',month:'2026-01',description:'Payment',kind:'expense',category:'Food',amount:500,account:'Test Bank',person:'',notes:'',effects:emptyEffects()};

let ledger=addCategory(addAccount(seed,'Test Bank'),'Test Category');
let deleted=manageLedgerItem(manageLedgerItem(ledger,'account','Test Bank','delete'),'category','Test Category','delete');
assert.ok(!activeItems(deleted,'account').includes('Test Bank'));
assert.ok(!activeItems(deleted,'category').includes('Test Category'));
assert.equal(itemStatus(addAccount(deleted,'Test Bank'),'account','Test Bank'),'active');
assert.equal(itemStatus(addCategory(deleted,'Test Category'),'category','Test Category'),'active');
assert.ok(!activeItems(manageLedgerItem(seed,'account','NBP','delete'),'account').includes('NBP'));
assert.ok(!activeItems(manageLedgerItem(seed,'category','Gifts','delete'),'category').includes('Gifts'));

ledger=prepareEntry(ledger,entry);
assert.throws(()=>manageLedgerItem(ledger,'account','Test Bank','archive'),/zero balance/);
assert.throws(()=>manageLedgerItem(ledger,'account','Test Bank','delete'),/history/);
assert.throws(()=>manageLedgerItem(ledger,'category','Food','delete'),/history/);
assert.throws(()=>manageLedgerItem({...ledger,entries:ledger.entries.map(e=>({...e,deleted:true}))},'category','Food','delete'),/history/);
assert.throws(()=>manageLedgerItem({...ledger,entries:[],audit:[{before:ledger.entries[0]}]},'account','Test Bank','delete'),/history/);
const forged={...ledger,categorySettings:{Food:{status:'deleted'}}};
assert.throws(()=>validateState(forged),/Keep category history/);

const before=ledger;
ledger=manageLedgerItem(manageLedgerItem(ledger,'account','Test Bank','rename','My Bank'),'category','Food','rename','Meals');
assert.deepEqual(totals(ledger),totals(before));
assert.deepEqual(ledger.entries,before.entries);
assert.equal(itemName(ledger,'account','Test Bank'),'My Bank');
assert.equal(itemName(ledger,'category','Food'),'Meals');
assert.throws(()=>addAccount(ledger,'my bank'),/already in use/);
assert.throws(()=>addCategory(ledger,'meals'),/already in use/);
assert.doesNotThrow(()=>checkTransition(before,ledger,'Rename'));

ledger=prepareEntry(ledger,{...entry,id:'replenish',kind:'income',category:'Salary'});
let archived=manageLedgerItem(manageLedgerItem(ledger,'account','Test Bank','archive'),'category','Food','archive');
assert.equal(totals(archived).accounts['Test Bank'],0);
assert.ok(!activeItems(archived,'account').includes('Test Bank'));
assert.ok(!activeItems(archived,'category').includes('Food'));
assert.doesNotThrow(()=>checkTransition(ledger,archived,'Archive'));
assert.throws(()=>checkTransition(archived,prepareEntry(archived,{...entry,id:'new',account:'Alfalah'}),'New payment'),/Restore Meals/);
const json=JSON.stringify(await createBackup(archived,10));
assert.equal((await verifyBackup(json)).entries,2);
archived=manageLedgerItem(archived,'account','Test Bank','restore');
assert.equal(itemName(archived,'account','Test Bank'),'My Bank');
assert.ok(activeItems(archived,'account').includes('Test Bank'));
console.log('PASS: rename, unused deletion, used and deleted transaction history, zero-balance archive, restore, and backup');
