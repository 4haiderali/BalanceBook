import assert from 'node:assert/strict';
import {lastConfirmedDates,positiveShare,sortCategoryCards} from '../lib/account-category-display.ts';

assert.equal(positiveShare(100,400)+positiveShare(300,400),1);
assert.equal(positiveShare(-50,400),0);
assert.equal(positiveShare(100,0),0);
assert.deepEqual([...lastConfirmedDates([
 {account:'Cash',date:'2026-11-20'},{account:'Bank',date:'2026-11-19'},{account:'Cash',date:'2026-10-20'},
])],[['Cash','2026-11-20'],['Bank','2026-11-19']]);
const cards=[{name:'Z',spend:0},{name:'A',spend:-10},{name:'M',spend:200},{name:'N',spend:50}];
assert.deepEqual(sortCategoryCards(cards,'spending').map(card=>card.name),['M','N','A','Z']);
assert.deepEqual(sortCategoryCards(cards,'name').map(card=>card.name),['A','M','N','Z']);
assert.deepEqual(sortCategoryCards(cards,'original').map(card=>card.name),['Z','A','M','N']);
console.log('PASS balance shares, latest checkpoint dates and category ordering');
