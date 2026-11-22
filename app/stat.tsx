import {formatMoney as money,currencyLabel} from '../lib/display-format';
export function Stat({label,value,hint='All recorded dates'}:{label:string;value:number;hint?:string}){return <div className="stat-card"><div className="stat-label">{label}</div><div className="stat-value">{currencyLabel()&&<span>{currencyLabel()}</span>} {money(value)}</div>{hint&&<small>{hint}</small>}</div>}
