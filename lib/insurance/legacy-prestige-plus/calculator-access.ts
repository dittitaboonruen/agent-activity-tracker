import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const COOKIE = "__Host-rp_legacy_access";
const TTL_SECONDS = 24 * 60 * 60;
const PURPOSE = "legacy-table-b:v1";
const LINK_PURPOSE = "legacy-link-grant:v1";
const MAX_LINK_LIFETIME_SECONDS = 10 * 60;

function secret(): string | null {
  const key = process.env.LEGACY_CALCULATOR_COOKIE_SECRET;
  return key && key.length >= 32 ? key : null;
}
function equalHex(left:string,right:string):boolean {
  if(!/^[a-f0-9]{64}$/.test(left)||!/^[a-f0-9]{64}$/.test(right))return false;
  return timingSafeEqual(Buffer.from(left,"hex"),Buffer.from(right,"hex"));
}
function signature(payload:string,key:string):string {
  return createHmac("sha256",key).update(PURPOSE+":"+payload).digest("hex");
}
export function validAccessCode(code:unknown):boolean {
  const hash=process.env.LEGACY_CALCULATOR_CODE_SHA256?.toLowerCase();
  if(typeof code!=="string"||code.length<20||code.length>256||!secret())return false;
  const supplied=createHash("sha256").update(code).digest("hex");
  // Preserve all existing users' credentials. This second, time-limited
  // owner entitlement exists ONLY on the separately configured QA Preview.
  // Never introduce this fallback on Production.
  const originalValid=typeof hash==="string" && equalHex(supplied,hash);
  const expires=Date.parse(process.env.LEGACY_QA_OWNER_CODE_EXPIRES_AT||"");
  const qaHash=process.env.LEGACY_QA_OWNER_CODE_SHA256?.toLowerCase();
  const qaValid=process.env.VERCEL_ENV==="preview" &&
    Number.isFinite(expires) && Date.now()<expires &&
    typeof qaHash==="string" && equalHex(supplied,qaHash);
  return originalValid || qaValid;
}
export function issueAccessCookie() {
  const key=secret();
  if(!key)throw Error("calculator_access_not_configured");
  const expires=Math.floor(Date.now()/1000)+TTL_SECONDS;
  const payload=String(expires);
  return {
    name:COOKIE,
    value:payload+"."+signature(payload,key),
    options:{httpOnly:true,secure:true,sameSite:"strict" as const,path:"/",maxAge:TTL_SECONDS},
  };
}
export function hasCalculatorAccess(request:NextRequest):boolean {
  const key=secret();
  const token=request.cookies.get(COOKIE)?.value;
  if(!key||!token||token.length>160)return false;
  const parts=token.split(".");
  if(parts.length!==2||!/^[0-9]{10}$/.test(parts[0])||
     !/^[a-f0-9]{64}$/.test(parts[1]))return false;
  const expiry=Number(parts[0]),now=Math.floor(Date.now()/1000);
  if(!Number.isSafeInteger(expiry)||expiry<=now||expiry>now+TTL_SECONDS)return false;
  return equalHex(signature(parts[0],key),parts[1]);
}

// Link-only entitlement: the distributor creates a signed short-lived URL
// offline, the server exchanges it for the existing HttpOnly calculator cookie.
// No dashboard user or typed passcode is required. Never expose the signing key.
export function validCalculatorLinkGrant(grant:unknown):boolean {
  if(process.env.LEGACY_LINK_ACCESS_ENABLED!=="true")return false;
  // Production requires a separately documented source-use clearance.
  if(process.env.VERCEL_ENV==="production" &&
     process.env.LEGACY_SOURCE_USE_APPROVED!=="true")return false;
  const key=secret();
  if(!key||typeof grant!=="string"||grant.length>140)return false;
  const parts=grant.split(".");
  if(parts.length!==2||!/^[0-9]{10}$/.test(parts[0])||
     !/^[a-f0-9]{64}$/.test(parts[1]))return false;
  const expiry=Number(parts[0]),now=Math.floor(Date.now()/1000);
  if(!Number.isSafeInteger(expiry)||expiry<=now||
     expiry>now+MAX_LINK_LIFETIME_SECONDS)return false;
  const expected=createHmac("sha256",key)
    .update(LINK_PURPOSE+":"+parts[0]).digest("hex");
  return equalHex(expected,parts[1]);
}
