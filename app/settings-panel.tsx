'use client';
import {setThemePreference,type ThemePreference} from '../lib/theme';
import {DEFAULT_DISPLAY,DISPLAY_OPTIONS,formatCurrency,formatDate,formatDateTime,type DisplayPreferences} from '../lib/display-format';
import {saveDisplayPreferences} from './display-preferences';
import {useThemePreference} from './theme-sync';

const OPTIONS:{id:ThemePreference;label:string;hint:string}[]=[
 {id:'system',label:'Match system',hint:'Follows your computer’s light or dark setting.'},
 {id:'light',label:'Light',hint:'Bright background with dark text.'},
 {id:'dark',label:'Dark',hint:'A dimmer look that is easier on the eyes at night.'},
];

// Each swatch is drawn with the real theme tokens, so it always matches what that theme looks like.
function Swatch({id}:{id:ThemePreference}){
 const preview=(theme:'light'|'dark',side='')=><span className={'theme-preview '+side} data-theme={theme}><i/><b><u/><u/><u/></b></span>;
 return <span className="theme-swatch" aria-hidden="true">{id==='system'?<>{preview('light','left')}{preview('dark','right')}</>:preview(id)}</span>;
}

export function SettingsPanel(){
 const {preference,resolved}=useThemePreference();
 return <div className="settings-page">
  <section className="panel settings-section" aria-labelledby="settings-appearance">
   <h2 id="settings-appearance">Appearance</h2>
   <p>Choose how BalanceBook looks on this computer. Your choice is remembered the next time you open the app.</p>
   <fieldset className="theme-options">
    <legend className="visually-hidden">Theme</legend>
    {OPTIONS.map(o=><label className="theme-option" key={o.id}>
     <input type="radio" name="theme" value={o.id} checked={preference===o.id} onChange={()=>setThemePreference(o.id)}/>
     <Swatch id={o.id}/>
     <strong>{o.label}</strong>
     <small>{o.hint}</small>
    </label>)}
   </fieldset>
   <p className="settings-status" role="status">Showing the {resolved} theme{preference==='system'?' because your system is set to '+resolved+'.':'.'}</p>
  </section>
 </div>;
}

const FORMAT_GROUPS=[
 {key:'dateStyle',label:'Date style',labels:['21 Nov 2026','21/11/2026','2026-11-21']},
 {key:'currency',label:'Currency label',labels:[DEFAULT_DISPLAY.currency,'Rs','None']},
 {key:'grouping',label:'Digit grouping',labels:['International (1,234,567)','South Asian (12,34,567)']},
 {key:'decimals',label:'Decimal places',labels:['Only when needed','Always show two']},
] as const;

export function FormatsPanel({preferences}:{preferences:DisplayPreferences}){
 return <div className="settings-page"><section className="panel settings-section settings-formats prose" aria-labelledby="settings-formats">
  <h2 id="settings-formats">Formats</h2>
  <div className="form-grid">{FORMAT_GROUPS.map(({key,label,labels})=><label key={key}>{label}
   <select value={preferences[key]} onChange={event=>saveDisplayPreferences({...preferences,[key]:event.target.value})}>
    {DISPLAY_OPTIONS[key].map((value,index)=><option value={value} key={value}>{labels[index]}</option>)}
   </select>
   {key==='dateStyle'&&<small>Date pickers follow Windows regional settings.</small>}
  </label>)}</div>
  <p role="status">Preview: {formatCurrency(123456750)} {'\u00b7'} {formatDate('2026-11-21')} {'\u00b7'} {formatDateTime('2026-11-21T18:06:00Z')}</p>
  <button type="button" className="button" onClick={()=>saveDisplayPreferences(DEFAULT_DISPLAY)}>Reset to defaults</button>
 </section></div>;
}
