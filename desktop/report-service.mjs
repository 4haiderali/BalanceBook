import {readFile} from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {atomicWrite} from './report-files';

const dateInKarachi=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export function createReportService(configPath,readSnapshot){
 const statusPath=configPath&&configPath+'.state.json';
 let status={folder:'',running:false,at:'',written:0,errors:[]};
 let timer,interval,active,pending=false,rebuild=false,closed=false;
 let previous;
 const folder=async()=>configPath?await readFile(configPath,'utf8').then(s=>s.replace(/^\uFEFF/,'')).catch(error=>{
  if(error.code==='ENOENT')return '';
  throw error;
 }):'';
 async function run(force){
  let destination='';
  try {
   destination=await folder();
   if(!destination){status={folder:'',running:false,at:'',written:0,errors:[]};return;}
   if(!previous)previous=await readFile(statusPath,'utf8').then(JSON.parse).catch(()=>undefined);
   if(previous?.folder!==destination)status={folder:destination,running:true,at:'',written:0,errors:[]};
   else status={...status,folder:destination,running:true};
   const {data,revision}=await readSnapshot();
   const result=await new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:{reportExport:{
     folder:destination,ledger:data,revision,today:dateInKarachi(),previous,force,
    }}});
    worker.once('message',message=>message.error?reject(Error(message.error)):resolve(message.result));
    worker.once('error',reject);
    worker.once('exit',code=>reject(Error('Export worker exited with code '+code+'.')));
   });
   const priorAt=previous?.folder===destination?previous.at:'';
   const at=!result.errors.length&&(result.written>0||!priorAt)?result.state.at:priorAt;
   previous={...result.state,at};
   await atomicWrite(statusPath,JSON.stringify(previous));
   status={folder:destination,running:false,at,backup:result.state.backup,written:result.written,errors:result.errors};
  } catch(error){
   status={...status,folder:destination,running:false,errors:[error instanceof Error?error.message:String(error)]};
  }
 }
 function queue(force=false,delay=800){
  if(!configPath||closed)return;
  pending=true;
  rebuild ||= force;
  if(active||timer)return;
  timer=setTimeout(()=>{
   timer=undefined;
   const requested=rebuild;
   rebuild=false;
   pending=false;
   active=run(requested).finally(()=>{
    active=undefined;
    if(pending)queue(false);
   });
  },delay);
 }
 return {
  queue,
  start(){if(configPath){queue(false,0);interval=setInterval(()=>queue(false,0),60000);}},
  async close(){closed=true;clearTimeout(timer);clearInterval(interval);await active;if(pending)await run(rebuild);},
  async GET(){
   const selected=await folder();
   return Response.json(selected===status.folder?status:{folder:selected,running:!!selected,at:'',written:0,errors:[]});
  },
  async POST(request){
   if(!configPath)return Response.json({error:'Automatic exports are available in the Windows app.'},{status:400});
   const force=(await request.json())?.rebuild;
   if(!await folder())return Response.json({error:'Choose an export folder first.'},{status:400});
   queue(force===true,0);
   return Response.json({queued:true},{status:202});
  },
 };
}
