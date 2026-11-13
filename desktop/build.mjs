import {build} from 'esbuild';
import {cp, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
await mkdir('desktop-dist', {recursive:true});
await build({
  entryPoints:['desktop/server.mjs'],
  outfile:'desktop-dist/server.mjs',
  bundle:true,
  platform:'node',
  format:'esm',
  plugins:[{
    name:'desktop-bindings',
    setup(builder){
      builder.onResolve({filter:/^cloudflare:workers$|\/personal-auth$/}, args=>({
        path:args.path.endsWith('/personal-auth')?'auth':'env',
        namespace:'desktop-bindings',
      }));
      builder.onLoad({filter:/.*/,namespace:'desktop-bindings'},args=>({
        contents:args.path==='env'
          ? 'export const env = {MIGRATION_ENABLED:"true", DESKTOP_LOCAL:true}'
          : `export const getOwner=()=>({userId:'local-haider',name:'Haider'});
             export function requireSameOrigin(request){
               if(request.headers.get('Origin')!==new URL(request.url).origin)
                 throw Error('Request must come from BalanceBook.');
             }`,
      }));
    },
  }],
});
await cp('drizzle','desktop-dist/drizzle',{recursive:true});
