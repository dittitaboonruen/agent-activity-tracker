import { NextRequest, NextResponse } from "next/server";
import {issueAccessCookie, validCalculatorLinkGrant, validAgentCalculatorGrant} from "@/lib/insurance/legacy-prestige-plus/calculator-access";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store, max-age=0",
  "Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, noarchive"};

export async function GET(request:NextRequest){
  const grant=request.nextUrl.searchParams.get("grant");
  const shortGrant=validCalculatorLinkGrant(grant);
  const agentGrant=!shortGrant&&validAgentCalculatorGrant(grant);
  if(!shortGrant&&!agentGrant)
    return NextResponse.json({ok:false,error:"link_expired_or_invalid"},
      {status:403,headers});
  // Exchange URL grant for an HttpOnly cookie and erase token from address bar.
  const next=new URL("/illustrations/royal_partners_illustration_tool.html?plan=legacy",request.url);
  const response=NextResponse.redirect(next,{status:303,headers});
  const cookie=issueAccessCookie(agentGrant?grant!.split('.')[0]:undefined);
  response.cookies.set(cookie.name,cookie.value,cookie.options);
  return response;
}
