// Authorized admin utility. Run locally with server-only environment values.
// Do not put a signing secret in browser code, public files, or chat messages.
import {createHmac} from 'node:crypto';
const secret=process.env.LEGACY_CALCULATOR_COOKIE_SECRET;
const base=process.env.LEGACY_CALCULATOR_BASE_URL;
if(typeof secret!=='string'||secret.length<32)throw Error('Missing server-only LEGACY_CALCULATOR_COOKIE_SECRET');
if(!base)throw Error('Set LEGACY_CALCULATOR_BASE_URL to the trusted project origin');
const url=new URL(base);
if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)
  throw Error('A plain HTTPS project origin is required');
const now=Math.floor(Date.now()/1000);
const expiry=String(now+300); // five-minute redeem window; cookie lasts 24h
const signature=createHmac('sha256',secret)
  .update('legacy-link-grant:v1:'+expiry).digest('hex');
const target=new URL('/api/legacy-prestige-link',url);
target.searchParams.set('grant',expiry+'.'+signature);
console.log('Share only with an authorized Royal Partner recipient.');
console.log('Link expires five minutes after generation; a redeemed session expires after 24 hours.');
console.log(target.href);
