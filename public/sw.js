// Network-only: never store ledger responses, pages, credentials or queued writes.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||request.mode!=='navigate'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||/\/(signin-with-chatgpt|signout-with-chatgpt|callback)(\/|$)/.test(url.pathname))return;
  event.respondWith(fetch(request).catch(()=>new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BalanceBook · Offline</title><style>body{margin:0;background:#f7f8f5;color:#203b30;font:17px system-ui;display:grid;place-items:center;min-height:100vh}main{max-width:440px;padding:32px}h1{font-size:30px}p{line-height:1.7}button{background:#285c48;color:white;border:0;border-radius:8px;padding:14px 24px;font:inherit}</style></head><body><main><h1>You’re offline</h1><p>Connect to the internet to open BalanceBook and see your latest saved records.</p><p>Offline transactions are not queued. If you had an unsaved form open, return to that window before reloading it.</p><button onclick="location.reload()">Try again</button></main></body></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
