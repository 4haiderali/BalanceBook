import assert from 'node:assert/strict';
import {loanAge} from '../lib/loan-age.ts';

const event=(person,kind,date,amount,deleted=false)=>({person,kind,date,amount,deleted});
const ledger={
 baselineDate:'2026-01-01',
 openingPeople:{opening:{receivable:100,payable:0}},
 entries:[
  event('multiple','lend','2026-01-10',100),
  event('multiple','repaymentIn','2026-01-15',120),
  event('partial','repaymentIn','2026-01-10',25),
  event('partial','lend','2026-01-03',100),
  event('full','lend','2026-01-03',100),
  event('full','repaymentIn','2026-01-12',100),
  event('multiple','lend','2026-01-02',100),
  event('opening','repaymentIn','2026-01-09',70),
  event('opening','lend','2026-01-07',20),
  event('none','lend','2026-01-18',100),
  event('none','groupReceipt','2026-01-20',100),
  event('none','repaymentIn','2026-01-25',100,true),
  event('none','repaymentIn','2026-02-01',100),
  event('groupOnly','groupPayment','2026-01-01',100),
 ],
};
const before=structuredClone(ledger);
const ages=loanAge(ledger,'2026-01-31');
assert.deepEqual(ages.get('partial'),{oldestUnpaidDate:'2026-01-03',lastRepaymentDate:'2026-01-10',daysOutstanding:28});
assert.deepEqual(ages.get('multiple'),{oldestUnpaidDate:'2026-01-10',lastRepaymentDate:'2026-01-15',daysOutstanding:21});
assert.deepEqual(ages.get('opening'),{oldestUnpaidDate:'2026-01-01',lastRepaymentDate:'2026-01-09',daysOutstanding:30});
assert.deepEqual(ages.get('none'),{oldestUnpaidDate:'2026-01-18',lastRepaymentDate:null,daysOutstanding:13});
assert.ok(!ages.has('full')&&!ages.has('groupOnly'));
assert.deepEqual(ledger,before);
console.log('PASS FIFO loan age, repayments, openings, group isolation and ledger immutability');
