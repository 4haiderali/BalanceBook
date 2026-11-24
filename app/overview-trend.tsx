'use client';

import {Bar,BarChart,CartesianGrid,Rectangle,ReferenceLine,XAxis,YAxis,usePlotArea,useYAxisScale,type BarShapeProps,type TooltipContentProps,type XAxisTickContentProps} from 'recharts';
import {ChartContainer,ChartTooltip,type ChartConfig} from '../components/ui/chart';
import {previousMonth} from '../lib/compare';
import {formatCurrency,monthName} from '../lib/display-format';
import {report,type Ledger} from '../lib/ledger';

const config={
 income:{label:'Income',color:'var(--chart-income)'},
 spend:{label:'Net spending',color:'var(--chart-spending)'},
} satisfies ChartConfig;

const compactFormat=new Intl.NumberFormat('en-PK',{notation:'compact',maximumFractionDigits:1});
const compact=(cents:number)=>compactFormat.format(cents/100).replace(/K$/,'k');

type MonthData={period:string;month:string;income:number;spend:number;surplus:number;empty:boolean};

function TrendTooltip({active,label,coordinate,data}:Pick<TooltipContentProps<number,string>,'active'|'label'|'coordinate'>&{data:MonthData[]}){
 const plot=usePlotArea();
 const yScale=useYAxisScale();
 const row=data.find(item=>item.period===label);
 if(!active||!coordinate||!row||!plot||!yScale)return null;
 const top=Number(yScale(Math.max(0,row.income,row.spend)));
 const width=220;
 const left=Math.max(0,Math.min(coordinate.x-width/2,plot.x+plot.width-width));
 return <div className="overview-trend-tooltip" style={{left,top:top-8,width}}>
  <div className="overview-trend-tooltip-title">{row.month}</div>
  <dl>
   <div><dt><span className="overview-trend-income-dot" aria-hidden="true"/>Income</dt><dd>{formatCurrency(row.income)}</dd></div>
   <div><dt><span className="overview-trend-spend-dot" aria-hidden="true"/>Net spending</dt><dd>{formatCurrency(row.spend)}</dd></div>
   <div><dt>{row.surplus<0?'Deficit':'Surplus'}</dt><dd>{formatCurrency(row.surplus)}</dd></div>
  </dl>
 </div>;
}

export function OverviewTrend({ledger,month}:{ledger:Ledger;month:string}){
 const months=[month];
 for(let i=1;i<6;i++)months.unshift(previousMonth(months[0]));
 const populatedMonths=new Set(ledger.entries.filter(entry=>!entry.deleted).map(entry=>entry.month));
 const data=months.map(period=>({...report(ledger,period),period,month:monthName(period),empty:!populatedMonths.has(period)}));

 function monthTick({x,y,payload}:XAxisTickContentProps){
  const row=data.find(item=>item.period===payload.value);
  if(!row)return <g/>;
  return <g transform={'translate('+x+','+y+')'} textAnchor="middle">
   <text className={row.period===month?'overview-trend-month overview-trend-selected':'overview-trend-month'} y={11}>{row.month.slice(0,3)}</text>
   {!row.empty&&<text className="overview-trend-cue" y={27} fill={row.surplus<0?'var(--expense-fg)':'var(--income-fg)'}>{row.surplus>0?'+':''}{compact(row.surplus)}</text>}
  </g>;
 }

 function barShape({x,y,width,height,fill,isActive,index}:BarShapeProps){
  const row=data[index];
  if(!row)return <g/>;
  const emphasized=isActive||row.period===month;
  const className=emphasized?'overview-trend-bar is-emphasized':'overview-trend-bar';
  if(row.empty)return <rect className={className} x={x} y={y-1} width={width} height={2} rx={1} fill={fill}/>;
  const radius=Math.min(6,Math.abs(height)/2,width/2);
  const corners:[number,number,number,number]=height<0?[0,0,radius,radius]:[radius,radius,0,0];
  return <Rectangle className={className} x={x} y={y} width={width} height={height} radius={corners} fill={fill}/>;
 }

 return <section className="panel overview-trend" aria-labelledby="overview-trend-title">
  <div className="panel-heading overview-trend-heading">
   <div><h2 id="overview-trend-title">Income and net spending</h2><p>Last six report months</p></div>
   <div><ul className="overview-trend-legend"><li><span className="overview-trend-income-dot" aria-hidden="true"/>Income</li><li><span className="overview-trend-spend-dot" aria-hidden="true"/>Net spending</li></ul><small className="overview-trend-cue-note">Figures below months show surplus or deficit</small></div>
  </div>
  <ChartContainer config={config} className="overview-trend-chart">
   <BarChart data={data} accessibilityLayer barGap={6} barCategoryGap="27%" margin={{top:15,right:8,bottom:0,left:0}}>
    <CartesianGrid vertical={false} stroke="var(--border)"/>
    <XAxis dataKey="period" tick={monthTick} tickMargin={4} height={38} axisLine={false} tickLine={false} interval={0}/>
    <YAxis width={48} tickFormatter={compact} tick={{fill:'var(--muted)',fontSize:12}} axisLine={false} tickLine={false}/>
    <ReferenceLine y={0} stroke="var(--border)" strokeWidth={2}/>
    <ChartTooltip cursor={false} position={{x:0,y:0}} allowEscapeViewBox={{x:true,y:true}} isAnimationActive={false}
     content={({active,label,coordinate})=><TrendTooltip active={active} label={label} coordinate={coordinate} data={data}/>}/>
    <Bar dataKey="income" name="Income" fill="var(--color-income)" barSize={22} shape={barShape} activeBar={barShape} isAnimationActive={false}/>
    <Bar dataKey="spend" name="Net spending" fill="var(--color-spend)" barSize={22} shape={barShape} activeBar={barShape} isAnimationActive={false}/>
   </BarChart>
  </ChartContainer>
  <table className="sr-only">
   <caption>Income and net spending by report month</caption>
   <thead><tr><th scope="col">Month</th><th scope="col">Income</th><th scope="col">Net spending</th><th scope="col">Surplus or deficit</th></tr></thead>
   <tbody>{data.map(row=><tr key={row.period}><th scope="row">{row.month}</th><td>{formatCurrency(row.income)}</td><td>{formatCurrency(row.spend)}</td><td>{formatCurrency(row.surplus)}</td></tr>)}</tbody>
  </table>
 </section>;
}
