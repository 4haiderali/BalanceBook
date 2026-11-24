import assert from 'node:assert/strict';
import {KINDS} from '../lib/ledger.ts';
import {LEGACY_TYPES} from '../lib/v2.ts';
import {filterTransactionTypes,transactionTypeFilter} from '../lib/transaction-type-filter.ts';

const entry=(kind,legacyType)=>({kind,legacyType});
const examples=[...Object.keys(KINDS).map(kind=>entry(kind)),...LEGACY_TYPES.map(type=>entry('legacy',type)),entry('futureKind')];
const ledger=Array.from({length:926},(_,index)=>examples[index%examples.length]);
const all=filterTransactionTypes(ledger,[]);
assert.equal(all.filtered.length,926);
assert.equal(Object.values(all.counts).reduce((sum,count)=>sum+count,0),926);
assert.equal(transactionTypeFilter(entry('officeRecovery')),'reimbursement');
assert.equal(transactionTypeFilter(entry('merchantRefund')),'reimbursement');
assert.equal(transactionTypeFilter(entry('groupReceipt')),'groupPayment');
assert.equal(transactionTypeFilter(entry('legacy','Borrowing Repaid')),'repayment');
assert.equal(transactionTypeFilter(entry('legacy','Lent')),'lending');
assert.equal(transactionTypeFilter(entry('groupPayment')),'groupPayment');
assert.equal(transactionTypeFilter(entry('legacy','Expense')),'expense');
assert.equal(transactionTypeFilter(entry('legacy','Internal Transfer')),'transfer');
assert.equal(transactionTypeFilter(entry('legacy','Adjustment Subtract')),'adjustment');
assert.equal(transactionTypeFilter(entry('legacy','Refund')),transactionTypeFilter(entry('refund')));
assert.equal(transactionTypeFilter(entry('legacy','Settlement In')),'settlement');
assert.equal(transactionTypeFilter(entry('futureKind')),'other');
const selected=filterTransactionTypes(ledger,['repayment','income']);
assert.deepEqual(selected.counts,all.counts);
assert.equal(selected.filtered.length,all.counts.repayment+all.counts.income);
assert.deepEqual(selected.filtered,ledger.filter(row=>['repayment','income'].includes(transactionTypeFilter(row))));
const sample=[
 ...Array.from({length:91},()=>entry('legacy','Settlement In')),
 ...Array.from({length:103},()=>entry('legacy','Settlement Out')),
 ...Array.from({length:8},()=>entry('refund')),
 ...Array.from({length:2},()=>entry('legacy','Refund')),
 entry('officeRecovery'),
 ...Array.from({length:9},()=>entry('legacy','Ignore')),
 ...Array.from({length:712},()=>entry('legacy','Expense')),
];
const settlements=filterTransactionTypes(sample,['settlement']);
assert.equal(settlements.filtered.length,194);
assert.equal(settlements.counts.reimbursement,11);
assert.equal(settlements.counts.other,9);
assert.equal(Object.values(settlements.counts).reduce((sum,count)=>sum+count,0),926);
console.log('PASS exhaustive transaction counts and OR selection');
