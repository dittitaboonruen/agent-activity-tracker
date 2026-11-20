import { NextRequest, NextResponse } from "next/server";
import { issueAccessCookie, validAccessCode } from "@/lib/insurance/legacy-prestige-plus/calculator-access";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store, max-age=0","X-Robots-Tag":"noindex, noarchive"};
export async function POST(request:NextRequest) {
  // Only accept a code from the same origin; never accept code in query params.
  const origin=request.headers.get("origin");
  if(!origin||origin!==request.nextUrl.origin)
    return NextResponse.json({ok:false,error:"invalid_origin"},{status:403,headers});
  const contentType=request.headers.get("content-type")||"";
  if(!contentType.toLowerCase().startsWith("application/json"))
    return NextResponse.json({ok:false,error:"invalid_request"},{status:415,headers});
  let code:unknown;
  try { const payload=await request.json();code=payload?.code; }
  catch {return NextResponse.json({ok:false,error:"invalid_request"},{status:400,headers});}
  if(!validAccessCode(code))
    return NextResponse.json({ok:false,error:"invalid_access_code"},{status:401,headers});
  const cookie=issueAccessCookie();
  const response=NextResponse.json({ok:true},{headers});
  response.cookies.set(cookie.name,cookie.value,cookie.options);
  return response;
}
