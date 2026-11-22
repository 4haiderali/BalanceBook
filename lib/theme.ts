// Theme preference: Match system (default), Light or Dark.
//
// The preference is stored in a cookie as well as localStorage. The Windows app serves
// the UI from http://127.0.0.1:<random port>, so every launch is a new origin and
// localStorage alone would forget the choice. Cookies ignore the port, so they survive.
// public/theme-init.js reads the same cookie before first paint to avoid a flash.
export type ThemePreference='system'|'light'|'dark';
export type ResolvedTheme='light'|'dark';
export const THEME_KEY='balancebook-theme';
export const THEME_EVENT='balancebook-theme-change';
const MAX_AGE=60*60*24*365;
export const isThemePreference=(value:unknown):value is ThemePreference=>value==='system'||value==='light'||value==='dark';

export function readThemePreference():ThemePreference{
  try{
    const match=document.cookie.match(new RegExp('(?:^|;\\s*)'+THEME_KEY+'=(system|light|dark)(?:;|$)'));
    if(match&&isThemePreference(match[1]))return match[1];
  }catch{/* cookies unavailable */}
  try{
    const stored=window.localStorage.getItem(THEME_KEY);
    if(isThemePreference(stored))return stored;
  }catch{/* storage unavailable */}
  return 'system';
}
export const systemTheme=():ResolvedTheme=>typeof window!=='undefined'&&window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light';
export const resolveTheme=(preference:ThemePreference):ResolvedTheme=>preference==='system'?systemTheme():preference;
export function applyTheme(theme:ResolvedTheme){document.documentElement.setAttribute('data-theme',theme)}
export function setThemePreference(preference:ThemePreference){
  try{document.cookie=`${THEME_KEY}=${preference}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax`}catch{/* ignore */}
  try{window.localStorage.setItem(THEME_KEY,preference)}catch{/* ignore */}
  applyTheme(resolveTheme(preference));
  window.dispatchEvent(new Event(THEME_EVENT));
}
