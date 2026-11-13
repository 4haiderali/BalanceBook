import type {Ledger} from './ledger';
// Immutable, owner-scoped content blocks are reused by all saved revisions.
// Only the small manifest is appended atomically to ledger_versions.
type DB={prepare:(sql:string)=>any};
type Manifest={storage:'haider-blocks-v1';meta:string[];entries:string[][];audit:string[][];sha256:string};
const encoder=new TextEncoder();
const hex=Array.from({length:256},(_,value)=>value.toString(16).padStart(2,'0'));
export async function digest(text:string){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
 let result='';
 for(const byte of bytes)result+=hex[byte];
 return result;
}
const blockChars=12000; // <=48KB UTF-8, well below D1's per-row limit.
export async function encodeLedger(l:Ledger){
 const blocks=new Map<string,string>();
 async function pack(value:unknown){
  const serialized=JSON.stringify(value);
  const chunks:string[]=[];
  for(let offset=0;offset<serialized.length;){
   let end=Math.min(offset+blockChars,serialized.length);
   const last=serialized.charCodeAt(end-1);
   if(end<serialized.length&&last>=0xD800&&last<=0xDBFF)end--;
   chunks.push(serialized.slice(offset,end));
   offset=end;
  }
  return Promise.all(chunks.map(async data=>{
   const hash=await digest(data);
   blocks.set(hash,data);
   return hash;
  }));
 }
 const {entries,audit,...meta}=l;
 function groups(items:unknown[]){
  const pending:Promise<string[]>[]=[];
  for(let i=0;i<items.length;i+=32)pending.push(pack(items.slice(i,i+32)));
  return Promise.all(pending);
 }
 const [metaRefs,entryRefs,auditRefs,sha256]=await Promise.all([
  pack(meta),groups(entries),groups(audit||[]),digest(JSON.stringify(l))
 ]);
 const manifest:Manifest={storage:'haider-blocks-v1',meta:metaRefs,entries:entryRefs,audit:auditRefs,sha256};
 // Preserve absence of audit, as well as property order, for exact legacy round trips.
 const orderedKeys=Object.keys(l);
 return {data:JSON.stringify({...manifest,orderedKeys}),blocks};
}
export async function stageLedger(db:DB,owner:string,l:Ledger,verifiedBlocks:ReadonlySet<string>=new Set<string>()){
 const encoded=await encodeLedger(l),rows=[...encoded.blocks].filter(([hash])=>!verifiedBlocks.has(hash)).map(([hash,data])=>({hash,data}));
 // Bounded bound parameters; never interpolate identities or ledger content into SQL.
 for(let i=0;i<rows.length;){const batch:typeof rows=[];let bytes=0;while(i<rows.length&&(bytes<250000||!batch.length)){const row=rows[i++];batch.push(row);bytes+=encoder.encode(JSON.stringify(row)).length}
 await db.prepare("INSERT OR IGNORE INTO ledger_blocks (owner,hash,data) SELECT ?, json_extract(value,'$.hash'), json_extract(value,'$.data') FROM json_each(?)").bind(owner,JSON.stringify(batch)).run()}
 return encoded.data;
}
export async function readLedger(db:DB,owner:string,data:string,verifiedBlocks?:Set<string>):Promise<Ledger>{
 const m=JSON.parse(data);if(m.storage!=='haider-blocks-v1')return m as Ledger;
 const manifest=m as Manifest&{orderedKeys:string[]};
 if(!Array.isArray(manifest.meta)||!Array.isArray(manifest.entries)||!Array.isArray(manifest.audit)||!Array.isArray(manifest.orderedKeys))throw Error('Saved ledger manifest is damaged.');
 const hashes=[...new Set([...manifest.meta,...manifest.entries.flat(),...manifest.audit.flat()])];
 const result=await db.prepare('SELECT hash,data FROM ledger_blocks WHERE owner=? AND hash IN (SELECT value FROM json_each(?))').bind(owner,JSON.stringify(hashes)).all();
 const blocks=new Map<string,string>();
 await Promise.all(result.results.map(async (row:{hash:string;data:string})=>{
  if(await digest(row.data)!==row.hash)throw Error('Saved ledger block failed its integrity check.');
  blocks.set(row.hash,row.data);
 }));
 function unpack(refs:string[]){return JSON.parse(refs.map(h=>{const s=blocks.get(h);if(s===undefined)throw Error('A saved ledger block is missing. Your previous records have not been replaced.');return s}).join(''))}
 const values={...unpack(manifest.meta),entries:manifest.entries.flatMap(unpack),audit:manifest.audit.flatMap(unpack)},l:Record<string,unknown>={};
 for(const key of manifest.orderedKeys)l[key]=values[key];
 if(await digest(JSON.stringify(l))!==manifest.sha256)throw Error('Saved ledger failed its integrity check.');
 if(verifiedBlocks)for(const hash of hashes)verifiedBlocks.add(hash);
 return l as unknown as Ledger;
}
