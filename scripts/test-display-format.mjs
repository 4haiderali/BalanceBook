import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {DEFAULT_DISPLAY,currencyAffix,formatCurrency,formatDate,formatDateTime,formatExactMoney,formatMoney,setDisplayPreferences,validateDisplayPreferences} from '../lib/display-format.ts';

const previous=new Intl.NumberFormat('en-PK',{maximumFractionDigits:2});
for(const amount of [0,13307006,6621600,-13307006,123456789]){
 assert.equal(formatMoney(amount),previous.format(amount/100));
}
assert.equal(formatMoney(13307006),'133,070.06');
assert.equal(formatMoney(6621600),'66,216');
assert.equal(formatDate('2026-11-21'),'21 Nov 2026');
const timestamp='2026-11-21T18:06:00Z';
assert.equal(formatDateTime(timestamp),'21 Nov 2026, 23:06');

setDisplayPreferences({grouping:'south-asian',currency:'Rs',dateStyle:'slash'});
assert.equal(formatMoney(133070006),'13,30,700.06');
assert.equal(formatCurrency(123400),'Rs 1,234');
assert.equal(formatExactMoney(123400),'1,234.00');
assert.equal(formatDate('2026-11-21'),'21/11/2026');
assert.equal(formatDateTime(timestamp),'21/11/2026, 23:06');

setDisplayPreferences({decimals:'always',currency:'none',dateStyle:'iso'});
assert.equal(formatMoney(6621600),'66,216.00');
assert.equal(formatCurrency(123400),'1,234.00');
assert.equal(currencyAffix(' (',')'),'');
assert.equal(formatDate('2026-11-21'),'2026-11-21');
assert.equal(formatDateTime(timestamp),'2026-11-21 23:06');
assert.deepEqual(validateDisplayPreferences({dateStyle:'invalid',currency:0,grouping:null,decimals:'invalid'}),DEFAULT_DISPLAY);
for(const name of readdirSync(new URL('../app/',import.meta.url),{recursive:true}).filter(name=>name.endsWith('.tsx'))){
 assert.doesNotMatch(readFileSync(new URL('../app/'+name.replaceAll('\\','/'),import.meta.url),'utf8'),/\bPKR\b/,name);
}
console.log('PASS display formats and shared currency labels');
