import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const COOKIE = "__Host-rp_legacy_access";
const TTL_SECONDS = 24 * 60 * 60;
const PURPOSE = "legacy-table-b:v1";

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
  if(typeof code!=="string"||code.length<20||code.length>256||
     !hash||!secret())return false;
  return equalHex(createHash("sha256").update(code).digest("hex"),hash);
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
