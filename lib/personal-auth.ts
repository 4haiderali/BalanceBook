import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';
import {digest} from './ledger-store';
export type Owner={userId:string;email:string;name:string};
export type AuthEnv={DB?:D1Database;GOOGLE_CLIENT_ID?:string;ALLOWED_EMAIL?:string;MIGRATION_ENABLED?:string};
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export const SESSION_COOKIE='__Host-haider-session',NONCE_COOKIE='__Host-haider-nonce';
export function randomToken(){return [...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('')}
export function cookieValue(request:Request,name:string){return request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||''}
export function privateCookie(name:string,value:string,maxAge:number){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`}
export function configured(env:AuthEnv){return Boolean(env.DB&&env.GOOGLE_CLIENT_ID?.endsWith('.apps.googleusercontent.com')&&env.ALLOWED_EMAIL?.trim())}
export function requireSameOrigin(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin)throw Error('Invalid origin.');if(new URL(request.url).protocol!=='https:')throw Error('HTTPS is required.');}
export async function verifyGoogleIdentity(token:string,clientId:string,allowedEmail:string,nonce:string,keys:JWTVerifyGetKey=googleKeys):Promise<Owner>{
 if(!nonce||!/^[a-f0-9]{64}$/.test(nonce))throw Error('Sign-in expired. Reload this page and try again.');
 const {payload}=await jwtVerify(token,keys,{algorithms:['RS256'],issuer:['accounts.google.com','https://accounts.google.com'],audience:clientId,requiredClaims:['sub','iat','exp','email','email_verified','nonce'],maxTokenAge:'10m',clockTolerance:5});
 const email=String(payload.email||'').toLowerCase();
 if((payload.azp!==undefined&&payload.azp!==clientId)||payload.nonce!==nonce||payload.email_verified!==true||email!==allowedEmail.trim().toLowerCase()||typeof payload.sub!=='string'||!payload.sub||(!email.endsWith('@gmail.com')&&!payload.hd))throw Error('This Google account is not allowed to open this private ledger.');
 return {userId:'google:'+payload.sub,email,name:typeof payload.name==='string'?payload.name:'Haider'};
}
export async function getOwner(request:Request,env:AuthEnv):Promise<Owner|null>{
 if(!configured(env))return null;const token=cookieValue(request,SESSION_COOKIE);if(!/^[a-f0-9]{64}$/.test(token))return null;
 const row=await env.DB!.prepare('SELECT owner,email,name FROM auth_sessions WHERE token_hash=? AND expires_at>?').bind(await digest(token),Date.now()).first<{owner:string;email:string;name:string}>();
 return row&&row.email===env.ALLOWED_EMAIL!.trim().toLowerCase()?{userId:row.owner,email:row.email,name:row.name}:null;
}
export async function createSession(owner:Owner,env:AuthEnv){const token=randomToken(),seconds=7*24*60*60;await env.DB!.prepare('INSERT INTO auth_sessions (token_hash,owner,email,name,expires_at) VALUES (?,?,?,?,?)').bind(await digest(token),owner.userId,owner.email,owner.name,Date.now()+seconds*1000).run();return privateCookie(SESSION_COOKIE,token,seconds)}
