'use client';
import {setThemePreference,type ThemePreference} from '../lib/theme';
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
