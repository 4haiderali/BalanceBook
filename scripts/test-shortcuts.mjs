import assert from 'node:assert/strict';
import {completeShortcut,dueSoon} from '../lib/shortcuts.ts';

const shortcut=(id,nextDue,overrides={})=>Object.freeze({
 id,name:id,kind:'expense',description:id,category:'Bills',account:'Cash',
 amount:1000,recurring:true,paused:false,nextDue,...overrides,
});
const shortcuts=Object.freeze([
 shortcut('cutoff','2026-02-04'),
 shortcut('after cutoff','2026-02-05'),
 shortcut('today','2026-01-28'),
 shortcut('overdue','2026-01-02'),
 shortcut('month end','2026-01-31'),
 shortcut('paused','2026-01-04',{paused:true}),
 shortcut('one off','2026-01-05',{recurring:false}),
]);
assert.deepEqual(dueSoon(shortcuts,'2026-01-28').map(s=>s.id),['overdue','today','month end','cutoff']);
assert.deepEqual(dueSoon(shortcuts,'2026-01-28',0).map(s=>s.id),['overdue','today']);
assert.deepEqual(dueSoon([shortcut('leap day','2028-02-29')],'2028-02-28',1).map(s=>s.id),['leap day']);
assert.deepEqual(dueSoon([shortcut('new year','2027-01-01')],'2026-12-31',1).map(s=>s.id),['new year']);
assert.deepEqual(dueSoon([],'2026-01-28'),[]);
const monthly={shortcuts:[shortcut('gym','2026-01-31',{dueDay:31})]};
assert.deepEqual(dueSoon(monthly.shortcuts,'2026-01-30',0),[]);
assert.equal(dueSoon(monthly.shortcuts,'2026-01-31',0).length,1);
assert.equal(dueSoon(monthly.shortcuts,'2026-02-01',0).length,1);
const february=completeShortcut(monthly,'gym','paid-january');
assert.equal(february.shortcuts[0].nextDue,'2026-02-28');
assert.equal(february.shortcuts[0].lastEntryId,'paid-january');
assert.deepEqual(dueSoon(february.shortcuts,'2026-02-01',0),[]);
assert.equal(completeShortcut(february,'gym','paid-february').shortcuts[0].nextDue,'2026-03-31');
console.log('PASS due date filtering, overdue ordering, and month, leap day, and year boundaries');
