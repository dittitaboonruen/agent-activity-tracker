// Create a 30-day private access link per approved Royal Partner agent.
// Server-only admin utility. Never run in the browser or commit the signing key.
import {createHmac,randomBytes} from 'node:crypto';
const secret=process.env.LEGACY_CALCULATOR_COOKIE_SECRET;
const base=process.env.LEGACY_CALCULATOR_BASE_URL;
if(!secret||secret.length<32)throw Error('Missing authorized server-only cookie signing secret');
if(!base)throw Error('Set LEGACY_CALCULATOR_BASE_URL to the expected HTTPS origin');
const origin=new URL(base);
if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||
   origin.pathname!=='/')throw Error('Expected a plain HTTPS deployment origin');
const id=randomBytes(16).toString('hex');
const expires=String(Math.floor(Date.now()/1000)+30*24*60*60-30);
const mac=createHmac('sha256',secret)
  .update('legacy-agent-link:v1:'+id+':'+expires).digest('hex');
const link=new URL('/api/legacy-prestige-link',origin);
link.searchParams.set('grant',id+'.'+expires+'.'+mac);
console.log('Share privately with ONE authorized agent. This URL is a credential.');
console.log('Agent link ID for revocation:',id);
console.log('Expiry:',new Date(Number(expires)*1000).toISOString());
console.log('Link:',link.toString());
