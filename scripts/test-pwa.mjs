import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const manifest=JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8'));
assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');
for(const icon of manifest.icons){const data=fs.readFileSync('public'+icon.src);assert.equal(data.readUInt32BE(16),Number(icon.sizes.split('x')[0]));assert.equal(data.readUInt32BE(20),Number(icon.sizes.split('x')[1]));}
const handlers={};let online=true;
const original=new Response('current signed-in page');
vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{URL,Response,self:{location:{origin:'https://money.test'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},fetch:async()=>{if(!online)throw Error('offline');return original}});
const request=(pathname,mode='navigate',method='GET')=>({url:'https://money.test'+pathname,mode,method});
async function fetchEvent(req){let result;handlers.fetch({request:req,respondWith(p){result=p}});return result?await result:null}
assert.equal(await fetchEvent(request('/')),original);
for(const path of ['/api/ledger','/api/ledger?revision=3','/signin-with-chatgpt','/signout-with-chatgpt','/callback'])assert.equal(await fetchEvent(request(path)),null);
assert.equal(await fetchEvent(request('/api/ledger','cors','POST')),null);
assert.equal(await fetchEvent(request('/icons/app-192.png','cors')),null);
online=false;const offline=await fetchEvent(request('/'));assert.equal(offline.status,503);assert.equal(offline.headers.get('Cache-Control'),'no-store');assert.match(await offline.text(),/You’re offline/);
// No cache object is provided: financial pages must never need persistent caches.
console.log('PASS PWA: manifest/icon sizes; network-only navigation; API/auth/write bypass; offline fallback without cached records.');
