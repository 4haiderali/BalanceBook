import {readFileSync,writeFileSync} from 'node:fs';
const guide=JSON.parse(readFileSync(new URL('../content/user-guide.json',import.meta.url),'utf8'));
const text=`<!-- Generated from content/user-guide.json. Run node scripts/generate-user-guide.mjs to update. -->
# ${guide.title}

${guide.intro}

Open **Help & guide** in the app sidebar. Included in Windows builds starting with **1.2.27**.

${guide.sections.map(s=>`- [${s.title}](#${s.id})`).join('\n')}

${guide.sections.map(s=>`<a id="${s.id}"></a>

## ${s.title}

${s.paragraphs.join('\n\n')}`).join('\n\n')}
`;
const target=new URL('../docs/USER-GUIDE.md',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(target,'utf8')!==text)throw Error('Regenerate docs/USER-GUIDE.md.');}
else writeFileSync(target,text);
