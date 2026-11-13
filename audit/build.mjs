// Bundles an audit script (TypeScript sources imported directly) with esbuild. Run from the project root.
import {build} from 'esbuild';import path from 'node:path';
const [,,src,out]=process.argv;
const mocks={'cloudflare:workers':`export const env=new Proxy({}, {get:(_,key)=>globalThis.__ENV?.[key] ?? (key==='DB'?globalThis.__DB:undefined)});`,'next/headers':`export async function headers(){return new Headers(globalThis.__hdrs||{})}`,'next/navigation':`export function redirect(p){throw new Error('redirect:'+p)}`};
await build({entryPoints:[src],bundle:true,platform:'node',format:'esm',outfile:out,loader:{'.json':'json'},logLevel:'error',external:['node:*'],nodePaths:[path.resolve(process.cwd(),'node_modules')],
 plugins:[{name:'mocks',setup(b){b.onResolve({filter:/^(cloudflare:workers|next\/headers|next\/navigation)$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}))}}],
 banner:{js:"import {createRequire} from 'module';const require=createRequire(import.meta.url);"}});
