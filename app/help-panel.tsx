import guide from '../content/user-guide.json';
export function HelpPanel(){
 return <div className="help-guide">
  <section className="panel prose"><h2>{guide.title}</h2><p>{guide.intro}</p><nav aria-label="Help topics"><ul>{guide.sections.map(s=><li key={s.id}><a href={`#help-${s.id}`}>{s.title}</a></li>)}</ul></nav></section>
  {guide.sections.map(s=><section className="panel prose" id={`help-${s.id}`} key={s.id} style={{scrollMarginTop:'1rem'}}><h2>{s.title}</h2>{s.paragraphs.map((text,i)=><p key={i}>{text}</p>)}<a href="#help-top">Back to help topics</a></section>)}
 </div>;
}
