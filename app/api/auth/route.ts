import {env} from 'cloudflare:workers';
import {configured,getOwner,randomToken,NONCE_COOKIE,SESSION_COOKIE,privateCookie,cookieValue,requireSameOrigin,verifyGoogleIdentity,createSession} from '../../../lib/personal-auth';
import {digest} from '../../../lib/ledger-store';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'strict-origin-when-cross-origin'}});
export async function GET(request:Request){
 if(!configured(env))return json({configured:false,authenticated:false});
 const owner=await getOwner(request,env);if(owner)return json({configured:true,authenticated:true,email:owner.email,migrationEnabled:env.MIGRATION_ENABLED==='true'});
 const nonce=randomToken(),r=json({configured:true,authenticated:false,clientId:env.GOOGLE_CLIENT_ID,nonce});r.headers.append('Set-Cookie',privateCookie(NONCE_COOKIE,nonce,600));return r;
}
export async function POST(request:Request){
 try{requireSameOrigin(request);if(!configured(env))return json({error:'Private sign-in setup is not complete.'},503);
 const text=await request.text();if(text.length>16000)return json({error:'Request too large.'},413);const body=JSON.parse(text);
 if(body.action==='logout'){const token=cookieValue(request,SESSION_COOKIE);if(token)await env.DB!.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await digest(token)).run();const r=json({signedOut:true});r.headers.append('Set-Cookie',privateCookie(SESSION_COOKIE,'',0));r.headers.append('Set-Cookie',privateCookie(NONCE_COOKIE,'',0));return r;}
 if(body.action!=='login'||typeof body.credential!=='string')return json({error:'Invalid sign-in request.'},400);
 const nonce=cookieValue(request,NONCE_COOKIE);if(body.nonce!==nonce)return json({error:'Sign-in expired. Reload this page.'},403);
 const owner=await verifyGoogleIdentity(body.credential,env.GOOGLE_CLIENT_ID!,env.ALLOWED_EMAIL!,nonce);
 await env.DB!.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').bind(Date.now()).run();
 const r=json({authenticated:true});r.headers.append('Set-Cookie',await createSession(owner,env));r.headers.append('Set-Cookie',privateCookie(NONCE_COOKIE,'',0));return r;
 }catch{return json({error:'Sign-in could not be completed. Check the Google account, or reload and try again.'},403)}
}
