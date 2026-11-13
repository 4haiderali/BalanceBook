'use client';
import {useEffect,useState} from 'react';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export function AppExperience(){
 const [offline,setOffline]=useState(false),[ready,setReady]=useState(false),[installed,setInstalled]=useState(false),[prompt,setPrompt]=useState<InstallEvent|null>(null),[help,setHelp]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{
  setReady(true);const media=window.matchMedia('(display-mode: standalone)');
  const connection=()=>setOffline(!navigator.onLine),mode=()=>setInstalled(media.matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone));
  const capture=(e:Event)=>{e.preventDefault();setPrompt(e as InstallEvent)},done=()=>{setInstalled(true);setPrompt(null);setHelp(false)};
  connection();mode();window.addEventListener('online',connection);window.addEventListener('offline',connection);window.addEventListener('beforeinstallprompt',capture);window.addEventListener('appinstalled',done);media.addEventListener('change',mode);
  if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{/* Installation via browser menus still works without the offline page. */});
  return()=>{window.removeEventListener('online',connection);window.removeEventListener('offline',connection);window.removeEventListener('beforeinstallprompt',capture);window.removeEventListener('appinstalled',done);media.removeEventListener('change',mode)};
 },[]);
 async function install(){if(!prompt){setHelp(true);return}try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')setMessage('Installation requested. You can open BalanceBook from your apps.')}catch{setHelp(true)}finally{setPrompt(null)}}
 if(!ready)return null;
 return <div className="app-experience">{offline&&<div role="status" className="offline-notice"><strong>You’re offline.</strong> Transactions cannot be saved until you reconnect. Keep this window open to retain any unsaved form.</div>}{!installed&&<div className="install-strip"><span>BalanceBook on your home screen</span><button className="text-button" onClick={prompt?install:()=>setHelp(!help)}>{prompt?'Install app':help?'Hide installation help':'How to install'}</button></div>}{message&&<p role="status" className="install-message">{message}</p>}{help&&!installed&&<section className="install-help" aria-label="Install BalanceBook"><h2>Install BalanceBook</h2><p>Open this link in your regular browser and sign in with your approved Google account.</p><ul><li><strong>Android · Chrome:</strong> browser menu → Add to Home screen → Install, if offered.</li><li><strong>iPhone · Safari:</strong> Share → Add to Home Screen → Add.</li><li><strong>PC · Chrome or Edge:</strong> use the install icon in the address bar, or the browser menu’s install option.</li></ul><p>The installed app uses the same online records. Internet is required to open records and save transactions. Installing on a different account does not transfer your ledger.</p><button className="button" onClick={()=>setHelp(false)}>Got it</button></section>}</div>
}
