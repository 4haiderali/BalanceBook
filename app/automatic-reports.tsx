import {useEffect,useState} from 'react';
import {desktopHost} from './desktop-host';

export type VerifiedBackup={at:string;path:string;revision:number};
type Status={backup?:VerifiedBackup;folder:string;running:boolean;at:string;written:number;errors:string[]};

export function AutomaticReports({savedAt,revision,manual}:{savedAt:string|null;revision:number;manual:VerifiedBackup|null}){
 const [status,setStatus]=useState<Status|null>(null);
 const [notice,setNotice]=useState('');
 const [requesting,setRequesting]=useState(false);

 async function refresh(signal?:AbortSignal){
  const response=await fetch('/api/reports',{cache:'no-store',signal});
  if(!response.ok)throw Error('Could not read automatic export status.');
  setStatus(await response.json());
 }
 async function queue(rebuild:boolean){
  setNotice('');
  setRequesting(true);
  try{
   const response=await fetch('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rebuild})});
   const result=await response.json() as {error?:string};
   if(!response.ok)throw Error(result.error||'Could not start exports.');
   setNotice(rebuild?'Report rebuild queued.':'Export queued.');
   await refresh();
  }catch(error){setNotice(error instanceof Error?error.message:'Could not start exports.');}
  finally{setRequesting(false);}
 }
 useEffect(()=>{
  const controller=new AbortController();
  const host=desktopHost();
  if(!host)return;
  const read=()=>void refresh(controller.signal).catch(error=>{if(!controller.signal.aborted)setNotice(error.message)});
  const receive:Parameters<typeof host.addEventListener>[1]=({data})=>{
   if(data.type==='backup-folder'){setNotice(data.error||'');return;}
   if(data.type!=='report-folder')return;
   if(data.state==='saved')void queue(false);
   if(data.state==='failed')setNotice(data.error||'Could not set the export folder.');
  };
  host.addEventListener('message',receive);
  read();
  const interval=window.setInterval(read,2500);
  return ()=>{controller.abort();window.clearInterval(interval);host.removeEventListener('message',receive);};
 },[]);

 const automatic=status?.backup;
 const latest=automatic&&(!manual||Date.parse(automatic.at)>=Date.parse(manual.at))?automatic:manual;
 const displayTime=(value:string)=>new Date(value).toLocaleString('en-GB',{timeZone:'Asia/Karachi'});
 return <section className="panel prose automatic-reports">
  <h2>Backup health</h2>
  <dl className="detail-fields">
   <dt>Ledger saved locally</dt><dd>Revision {revision}{savedAt?' · '+displayTime(savedAt)+' PKT':''}</dd>
   <dt>Latest verified backup</dt><dd>{latest?<>Revision {latest.revision} · {displayTime(latest.at)} PKT · {latest===automatic?'Automatic':'Manual'}<br/><span className="report-folder-path">{latest.path}</span></>:!status||status.running?'Checking automatic backup…':'No verified backup recorded yet.'}</dd>
   {latest&&latest.revision!==revision&&<><dt>Revision differs</dt><dd>This backup was verified for a different ledger revision.</dd></>}
  </dl>
  <h3>Automatic reports and backups</h3>
  <p>Choose a OneDrive folder or any other folder. BalanceBook creates Monthly, Yearly, Summaries, and Backups there and refreshes them while the app is open.</p>
  {status?.folder&&<p className="report-folder-path"><strong>Folder</strong> {status.folder}</p>}
  <div className="button-row">
   <button className="button primary" onClick={()=>desktopHost()?.postMessage('choose-report-folder')}>{status?.folder?'Change folder':'Choose export folder'}</button>
   {status?.folder&&<><button className="button" onClick={()=>desktopHost()?.postMessage('open-backup-folder')}>Open backup folder</button><button className="button" disabled={requesting||status.running} onClick={()=>void queue(false)}>Refresh now</button>
   <button className="button" disabled={requesting||status.running} onClick={()=>void queue(true)}>Rebuild all reports</button></>}
  </div>
  {status?.running&&<p role="status">Updating reports and backups…</p>}
  {status?.at&&<p>Last complete local export {new Date(status.at).toLocaleString('en-GB')}.</p>}
  {notice&&<p role="status">{notice}</p>}
  {!!status?.errors.length&&<div className="form-error" role="alert"><strong>Some exports could not finish. The app will retry while it is open.</strong><ul>{status.errors.slice(0,6).map(error=><li key={error}>{error}</li>)}</ul>{status.errors.length>6&&<p>{status.errors.length-6} more files need attention.</p>}</div>}
  {status?.folder&&<p>Files are saved locally. If this is a OneDrive folder, check OneDrive for cloud upload status.</p>}
 </section>;
}
