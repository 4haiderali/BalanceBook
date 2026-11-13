import {formatMoney as money} from '../lib/display-format';
export function Stat({label,value,hint='All recorded dates'}:{label:string;value:number;hint?:string}){return <div className="stat-card"><div className="stat-label">{label}</div><div className="stat-value"><span>Rs</span> {money(value)}</div>{hint&&<small>{hint}</small>}</div>}
