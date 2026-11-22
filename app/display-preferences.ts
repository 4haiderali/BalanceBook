'use client';
import {useEffect,useState} from 'react';
import {DEFAULT_DISPLAY,setDisplayPreferences,validateDisplayPreferences,type DisplayPreferences} from '../lib/display-format';

const KEY='balancebook-display';
const EVENT='balancebook-display-change';
const MAX_AGE=60*60*24*365;

function readPreferences(){
 try{
  const cookie=document.cookie.split('; ').find(part=>part.startsWith(KEY+'='));
  if(cookie)return validateDisplayPreferences(JSON.parse(decodeURIComponent(cookie.slice(KEY.length+1))));
 }catch{return {...DEFAULT_DISPLAY}}
 try{return validateDisplayPreferences(JSON.parse(window.localStorage.getItem(KEY)??'null'))}
 catch{return {...DEFAULT_DISPLAY}}
}

export function initializeDisplayPreferences(){setDisplayPreferences(readPreferences())}

export function saveDisplayPreferences(value:DisplayPreferences){
 const preferences=validateDisplayPreferences(value);
 const serialized=JSON.stringify(preferences);
 try{document.cookie=KEY+'='+encodeURIComponent(serialized)+'; Max-Age='+MAX_AGE+'; Path=/; SameSite=Lax'}catch{}
 try{window.localStorage.setItem(KEY,serialized)}catch{}
 setDisplayPreferences(preferences);
 window.dispatchEvent(new CustomEvent(EVENT,{detail:preferences}));
}

export function useDisplayPreferences(){
 const [preferences,setPreferences]=useState(readPreferences);
 useEffect(()=>{
  const update=(event:Event)=>setPreferences((event as CustomEvent<DisplayPreferences>).detail);
  window.addEventListener(EVENT,update);
  return ()=>window.removeEventListener(EVENT,update);
 },[]);
 return preferences;
}
