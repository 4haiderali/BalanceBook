'use client';
import {useEffect,useState} from 'react';
import {applyTheme,readThemePreference,resolveTheme,THEME_EVENT,type ResolvedTheme,type ThemePreference} from '../lib/theme';

export function useThemePreference(){
  const [preference,setPreference]=useState<ThemePreference>('system'),[resolved,setResolved]=useState<ResolvedTheme>('light');
  useEffect(()=>{
    const sync=()=>{const next=readThemePreference(),theme=resolveTheme(next);setPreference(next);setResolved(theme);applyTheme(theme)};
    sync();
    const media=window.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener?.('change',sync);
    window.addEventListener(THEME_EVENT,sync);
    window.addEventListener('storage',sync);
    return()=>{media?.removeEventListener?.('change',sync);window.removeEventListener(THEME_EVENT,sync);window.removeEventListener('storage',sync)};
  },[]);
  return {preference,resolved};
}

// Mounted once at the top of each page so "Match system" follows Windows while the app is open.
export function ThemeSync(){useThemePreference();return null}
