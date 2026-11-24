import assert from 'node:assert/strict';
import {delta,describeDelta,previousMonth} from '../lib/compare.ts';

assert.equal(previousMonth('2026-01'),'2025-12');
assert.equal(previousMonth('2026-10'),'2026-09');
assert.deepEqual(delta(450,0),{amount:450,percent:null});
assert.deepEqual(delta(-1500,-1000),{amount:-500,percent:-50});
assert.equal(describeDelta(-1500,-1000,'October'),'50% lower than October');
assert.equal(describeDelta(500,-1000,'October'),'150% higher than October');
assert.equal(describeDelta(450,0,'October'),'PKR 4.50 higher than October');
console.log('PASS month rollover and comparisons against zero and net refunds');
