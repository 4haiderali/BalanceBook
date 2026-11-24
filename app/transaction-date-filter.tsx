'use client';

import {useState,type ReactNode} from 'react';
import {CalendarDays,ChevronDown} from 'lucide-react';
import type {DateRange} from 'react-day-picker';
import {Calendar} from '../components/ui/calendar';
import {Popover,PopoverContent,PopoverTrigger} from '../components/ui/popover';
import {today} from '../lib/dates';
import {formatDate,monthName} from '../lib/display-format';

const presets=[
 ['all','All time'],['month','This month'],['previous','Last month'],
 ['quarter','Last 3 months'],['year','This year'],['custom','Custom range'],
] as const;

type Preset=typeof presets[number][0];
type DateBasis='actual'|'report';
export type TransactionDateSelection={basis:DateBasis;preset:Preset;from:string;to:string};
export const ALL_TRANSACTION_DATES:TransactionDateSelection={basis:'actual',preset:'all',from:'',to:''};

function calendarDate(iso:string){
 const [year,month,day]=iso.split('-').map(Number);
 return new Date(year,month-1,day);
}

function calendarIso(date:Date){
 const parts=[date.getFullYear(),date.getMonth()+1,date.getDate()];
 return parts.map((part,index)=>String(part).padStart(index===0?4:2,'0')).join('-');
}

function presetDates(preset:Exclude<Preset,'custom'>,basis:DateBasis):TransactionDateSelection{
 if(preset==='all')return {...ALL_TRANSACTION_DATES,basis};
 const [year,month]=today().split('-').map(Number);
 const startMonth=preset==='year'?0:preset==='quarter'?month-3:preset==='previous'?month-2:month-1;
 const endMonth=preset==='year'?12:preset==='previous'?month-1:month;
 return {basis,preset,from:calendarIso(new Date(year,startMonth,1)),to:calendarIso(new Date(year,endMonth,0))};
}

export function TransactionDateFilter({value,onChange,leading,actions,children}:{
 value:TransactionDateSelection;onChange:(value:TransactionDateSelection)=>void;leading:ReactNode;actions:ReactNode;children:ReactNode;
}){
 const [open,setOpen]=useState(false);
 const [custom,setCustom]=useState(false);
 const [draft,setDraft]=useState<DateRange>();
 const [basis,setBasis]=useState<DateBasis>(value.basis);
 const displayDate=basis==='report'?(iso:string)=>monthName(iso.slice(0,7)):formatDate;
 const rangeLabel=value.basis==='report'
  ?[value.from,value.to].map(iso=>iso?monthName(iso.slice(0,7)):'').join(' to ')
  :[value.from,value.to].map(iso=>iso?formatDate(iso):'').join(' to ');
 const label=value.preset==='all'?'All dates':rangeLabel;

 function changeOpen(next:boolean){
  setOpen(next);
  if(!next)return;
  setBasis(value.basis);
  setCustom(value.preset==='custom');
  setDraft(value.preset==='custom'?{from:calendarDate(value.from),to:calendarDate(value.to)}:undefined);
 }
 function commit(selection:TransactionDateSelection){
  onChange(selection);
  setOpen(false);
 }

 return <Popover open={open} onOpenChange={changeOpen}>
   <div className="transaction-filter-row transaction-toolbar">
    {leading}
    <PopoverTrigger asChild>
     <button type="button" className="button transaction-date-trigger" aria-label={'Date: '+label}>
      <CalendarDays size={16} aria-hidden="true"/><span>{label}</span><ChevronDown size={14} aria-hidden="true"/>
     </button>
    </PopoverTrigger>
    {actions}
   </div>
   {children}
  <PopoverContent className="transaction-date-popover" side="bottom" align="end" sideOffset={6} collisionPadding={12} aria-label="Transaction date filter">
   <div className="transaction-date-basis" role="group" aria-label="Date basis">
    {(['actual','report'] as const).map(option=><button type="button" className="button" key={option} aria-pressed={basis===option} onClick={()=>{
     setBasis(option);
     onChange({...value,basis:option});
    }}>{option==='actual'?'Actual date':'Report month'}</button>)}
   </div>
   <div className="transaction-date-presets" role="group" aria-label="Date presets">
    {presets.map(([preset,name])=><button type="button" key={preset} className="button" aria-pressed={custom?preset==='custom':value.preset===preset} onClick={()=>{
     if(preset==='custom'){setCustom(true);return}
     commit(presetDates(preset,basis));
    }}>{name}</button>)}
   </div>
   {custom&&<>
    <p className="transaction-date-help">{basis==='report'?'Select dates in the first and last report months.':'Select the first and last dates.'}</p>
    <Calendar mode="range" selected={draft} onSelect={setDraft} resetOnSelect defaultMonth={draft?.from??(value.from?calendarDate(value.from):calendarDate(today()))}
     today={calendarDate(today())} showOutsideDays={false} aria-label="Custom date range"/>
    {draft?.from&&<p className="transaction-date-help" aria-live="polite">{displayDate(calendarIso(draft.from))}{draft.to?' to '+displayDate(calendarIso(draft.to)):''}</p>}
   </>}
   <div className="transaction-date-footer">
    <button type="button" className="text-button" onClick={()=>commit({...ALL_TRANSACTION_DATES,basis})}>Clear</button>
    {custom&&<button type="button" className="button primary" disabled={!draft?.from} onClick={()=>{
     if(draft?.from)commit({basis,preset:'custom',from:calendarIso(draft.from),to:calendarIso(draft.to??draft.from)});
    }}>Apply range</button>}
   </div>
  </PopoverContent>
 </Popover>;
}
