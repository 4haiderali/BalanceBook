import {createHash, randomUUID} from 'node:crypto';
import {mkdir, open, readFile, readdir, rename, rm, stat} from 'node:fs/promises';
import {join} from 'node:path';
import * as XLSX from 'xlsx';
import {createBackup, verifyBackup} from '../lib/backup';
import {buildExcel} from '../lib/excel';
import {itemName} from '../lib/ledger-items';
import {buildMonthlyWorkbook,monthlyData} from './monthly-workbook';
import {report, type Ledger} from '../lib/ledger';

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const sha = (value:unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const dailyName = /^Haider_Money_(\d{4}-\d{2}-\d{2})\.json$/;
const currency = '#,##0.00;[Red](#,##0.00);0.00';

export async function atomicWrite(file:string, bytes:Buffer|string, verify?:(file:string)=>Promise<unknown>){
 const temporary=file+'.'+randomUUID()+'.tmp';
 try {
  const handle=await open(temporary,'wx');
  try { await handle.writeFile(bytes); await handle.sync(); }
  finally { await handle.close(); }
  if(verify)await verify(temporary);
  await rename(temporary,file);
 } finally { await rm(temporary,{force:true}).catch(()=>{}); }
}

async function exists(file:string){
 try { return (await stat(file)).isFile(); }
 catch(error){ if((error as NodeJS.ErrnoException).code==='ENOENT')return false; throw error; }
}

function numericSheet(rows:(string|number)[][], widths:number[]){
 const sheet=XLSX.utils.aoa_to_sheet(rows);
 sheet['!cols']=widths.map(wch=>({wch}));
 for(const [key,cell] of Object.entries(sheet))if(!key.startsWith('!')&&cell.t==='n')cell.z=currency;
 return sheet;
}

function monthlyRows(ledger:Ledger,year:string){
 return monthNames.map((label,index)=>{
  const values=report(ledger,year+'-'+String(index+1).padStart(2,'0'));
  return [label,values.income/100,values.spend/100,values.surplus/100,values.refunds/100];
 });
}

function annualSheet(ledger:Ledger,year:string){
 const total=report(ledger,year);
 return numericSheet([['Month','Income (PKR)','Net spending (PKR)','Surplus (PKR)','Refunds (PKR)'],
  ...monthlyRows(ledger,year),['Year total',total.income/100,total.spend/100,total.surplus/100,total.refunds/100]],
  [19,20,23,20,20]);
}

function summaryBook(ledger:Ledger,year:string){
 const workbook=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(workbook,annualSheet(ledger,year),'Year Summary');
 const categories=Object.entries(report(ledger,year).categories).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 XLSX.utils.book_append_sheet(workbook,numericSheet([['Category','Net spending (PKR)'],
  ...categories.map(([name,value])=>[itemName(ledger,'category',name),value/100])],[32,24]),'Categories');
 return workbook;
}

function styleSummary(bytes:Buffer,monthlyHeader?:number){
 // SheetJS CE writes the workbook data. Add the summary formatting to the generated OOXML.
 const zip=XLSX.CFB.read(bytes,{type:'buffer'});
 function patch(part:string, update:(xml:string)=>string){
  const entry=XLSX.CFB.find(zip,part);
  if(!entry)throw Error('Workbook is missing '+part);
  entry.content=Buffer.from(update(Buffer.from(entry.content).toString('utf8')),'utf8');
  entry.size=entry.content.length;
 }
 let headerStyle=0;
 patch('/xl/styles.xml',xml=>{
  let font=0,fill=0;
  const append=(name:string,extra:()=>string,index:(count:number)=>void)=>(value:string)=>value.replace(
   new RegExp('<'+name+' count="(\\d+)">([\\s\\S]*?)</'+name+'>'),
   (_match,count,inside)=>{index(Number(count));return '<'+name+' count="'+(Number(count)+1)+'">'+inside+extra()+'</'+name+'>';});
  xml=append('fonts',()=>'<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',i=>font=i)(xml);
  xml=append('fills',()=>'<fill><patternFill patternType="solid"><fgColor rgb="FF182D62"/><bgColor indexed="64"/></patternFill></fill>',i=>fill=i)(xml);
  return append('cellXfs',()=>'<xf numFmtId="0" fontId="'+font+'" fillId="'+fill+'" borderId="0" xfId="0" applyFont="1" applyFill="1"/>',i=>headerStyle=i)(xml);
 });
 const dataBar=(range:string,color:string,priority:number)=>'<conditionalFormatting sqref="'+range+'"><cfRule type="dataBar" priority="'+priority+'"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="'+color+'"/></dataBar></cfRule></conditionalFormatting>';
 function headers(xml:string,rows:number[]){
  return xml.replace(/<row r="(\d+)"[^>]*>[\s\S]*?<\/row>/g,(row,index)=>rows.includes(Number(index))?row.replace(/<c r="([A-Z]+\d+)"/g,'<c r="$1" s="'+headerStyle+'"'):row);
 }
 if(monthlyHeader!==undefined){
  patch('/xl/worksheets/sheet1.xml',xml=>headers(xml,[6,12,monthlyHeader]));
  patch('/xl/worksheets/sheet2.xml',xml=>headers(xml,[3]).replace(/<sheetViews>[\s\S]*?<\/sheetViews>/,
   '<sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A4" sqref="A4"/></sheetView></sheetViews>'));
  patch('/xl/worksheets/sheet4.xml',xml=>headers(xml,[4]));
 }else{
 patch('/xl/worksheets/sheet1.xml',xml=>xml
  .replace(/<row r="1"[^>]*>[\s\S]*?<\/row>/,row=>row.replace(/<c r="([A-Z]+1)"/g,'<c r="$1" s="'+headerStyle+'"'))
  .replace('</sheetData>','</sheetData>'+dataBar('B2:B13','FF7BC8AA',1)+dataBar('C2:C13','FF9CB8F6',2)+dataBar('D2:D13','FFB7A4E4',3)));
 patch('/xl/worksheets/sheet2.xml',xml=>xml.replace(/<row r="1"[^>]*>[\s\S]*?<\/row>/,row=>row.replace(/<c r="([A-Z]+1)"/g,'<c r="$1" s="'+headerStyle+'"')));
 }
 return XLSX.CFB.write(zip,{fileType:'zip',type:'buffer',compression:true}) as Buffer;
}

function workbookBytes(workbook:XLSX.WorkBook){
 return XLSX.write(workbook,{bookType:'xlsx',type:'buffer',compression:true}) as Buffer;
}

async function pruneBackups(folder:string,today:string){
 const files=(await readdir(folder)).filter(name=>dailyName.test(name)&&dailyName.exec(name)![1]<=today).sort().reverse();
 const keep=new Set(files.slice(0,7));
 const archivedMonths=new Set<string>();
 for(const name of files){
  const month=dailyName.exec(name)![1].slice(0,7);
  if(month>=today.slice(0,7)||archivedMonths.has(month))continue;
  archivedMonths.add(month);
  keep.add(name);
 }
 for(const name of files)if(!keep.has(name))await rm(join(folder,name),{force:true});
}

export type VerifiedBackup={at:string;revision:number;path:string};
export type ReportState={folder:string;date:string;backupHash:string;backup?:VerifiedBackup;files:Record<string,string>;at:string};

export async function writeReportFiles({folder,ledger,revision,today,previous,force}:{
 folder:string;ledger:Ledger;revision:number;today:string;previous?:ReportState;force:boolean;
}){
 if(!(await stat(folder)).isDirectory())throw Error('The selected export folder is unavailable.');
 const state:ReportState={folder,date:today,backupHash:sha([revision,ledger]),files:{},at:new Date().toISOString()};
 const sameFolder=previous?.folder===folder?previous:undefined;
 const errors:string[]=[];
 let written=0;
 const groups=new Map<string,Ledger['entries']>();
 const currentMonth=today.slice(0,7);
 groups.set(currentMonth,[]);
 for(const entry of ledger.entries){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(entry.month))continue;
  const group=groups.get(entry.month)||[];
  group.push(entry);
  groups.set(entry.month,group);
 }
 const years=new Map<string,Ledger['entries']>();
 // A previous destination may contain periods that no longer exist in the ledger.
 // Reconcile report filenames on disk as well as the last run's cached paths.
 const periodFiles=[
  {kind:'Monthly',pattern:/^(\d{4}-(?:0[1-9]|1[0-2]))\.xlsx$/,periods:groups},
  {kind:'Yearly',pattern:/^(\d{4})\.xlsx$/,periods:years},
  {kind:'Summaries',pattern:/^(\d{4}) Summary\.xlsx$/,periods:years},
 ];
 const cached=Object.keys(sameFolder?.files||{});
 for(const {kind,pattern,periods} of periodFiles){
  const names=cached.filter(key=>key.startsWith(kind+'/')).map(key=>key.slice(kind.length+1));
  try {
   const files=await readdir(join(folder,kind),{withFileTypes:true});
   names.push(...files.filter(file=>file.isFile()).map(file=>file.name));
  } catch(error){
   if((error as NodeJS.ErrnoException).code!=='ENOENT')
    errors.push(kind+': '+(error instanceof Error?error.message:String(error)));
  }
  for(const name of names){
   const period=pattern.exec(name)?.[1];
   if(period&&!periods.has(period))periods.set(period,[]);
  }
 }
 async function output(kind:string,name:string,hash:string,build:()=>Buffer){
  const key=kind+'/'+name;
  const target=join(folder,kind,name);
  try {
   if(force||sameFolder?.files[key]!==hash||!await exists(target)){
    await mkdir(join(folder,kind),{recursive:true});
    await atomicWrite(target,build());
    written++;
   }
   state.files[key]=hash;
  } catch(error){state.files[key]='';errors.push(['EBUSY','EPERM','EACCES'].includes((error as NodeJS.ErrnoException).code||'')?'Could not update '+name+'. If it is open in Excel, close it so BalanceBook can retry. Otherwise, check folder permissions.':key+': '+(error instanceof Error?error.message:String(error)));}
 }
 for(const [month,entries] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
  const year=month.slice(0,4);
  const yearEntries=years.get(year)||[];
  yearEntries.push(...entries);
  years.set(year,yearEntries);
  const data=monthlyData(ledger,month,today);
  await output('Monthly',month+'.xlsx',sha(['monthly-v3',entries,ledger.people,ledger.accountSettings,ledger.categorySettings,data]),()=>{
   const stamp='Generated '+new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Karachi',dateStyle:'medium',timeStyle:'short'}).format(new Date(state.at))+' PKT · Ledger revision '+revision+' · BalanceBook 1.2.26';
   const {workbook,topHeader}=buildMonthlyWorkbook({...ledger,entries},month,data,stamp);
   return styleSummary(workbookBytes(workbook),topHeader);
  });
 }
 for(const [year,entries] of years){
  const data={...ledger,entries};
  await output('Yearly',year+'.xlsx',sha(['yearly-v2',entries,ledger.people,ledger.accountSettings,ledger.categorySettings]),()=>{
   const workbook=buildExcel(data,{basis:'report',from:year+'-01',to:year+'-12'});
   XLSX.utils.book_append_sheet(workbook,annualSheet(data,year),'Monthly Totals');
   return workbookBytes(workbook);
  });
  await output('Summaries',year+' Summary.xlsx',sha(['summary-v2',entries,ledger.categorySettings]),()=>styleSummary(workbookBytes(summaryBook(data,year))));
 }
 const backupFolder=join(folder,'Backups');
 const backupFile=join(backupFolder,'Haider_Money_'+today+'.json');
 try {
  if(sameFolder?.backup&&await exists(sameFolder.backup.path))state.backup=sameFolder.backup;
  const needsBackup=force||!state.backup||!await exists(backupFile)||sameFolder?.backupHash!==state.backupHash||sameFolder?.date!==today;
  if(needsBackup){
   await mkdir(backupFolder,{recursive:true});
   const backup=await createBackup(ledger,revision);
   await atomicWrite(backupFile,JSON.stringify(backup),async file=>{
    const result=await verifyBackup(await readFile(file,'utf8'));
    if(!result.checksum||result.revision!==revision)throw Error('The saved backup did not match the ledger.');
   });
   state.backup={at:new Date().toISOString(),revision,path:backupFile};
   written++;
  }
  if(needsBackup||errors.length)await pruneBackups(backupFolder,today);
 } catch(error){
  state.backupHash='';
  errors.push('Backups: '+(error instanceof Error?error.message:String(error)));
 }
 return {state,written,errors};
}

