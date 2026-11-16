import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { brotliDecompressSync } from "node:zlib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// AIA Legacy Prestige Plus (New) Table B ONLY, internal authorized QA.
// Source: AIA internal 2025 manual supplied by the project owner.
// Original LEGACY_RPU_MALE_FACTORS_BR_B64 is superseded for Table B.
// NO raw factors, entire tables or environment values are sent to the client.
// Do not release as AIA-approved quotation or merge to production without clearance.
type Gender = "M" | "F";
type Factors = Record<string, Record<Gender, {cv:number[][];rpu:number[][]}>>;
const noStore = {"Cache-Control":"private, no-store, max-age=0","X-Robots-Tag":"noindex, noarchive"};
let factorCache: Factors | null = null;

function getVerifiedFactors(): Factors | null {
  if (factorCache) return factorCache;
  const encoded = process.env.LEGACY_TABLE_B_FACTORS_BR_B64;
  if (!encoded) return null;
  try {
    const decoded = brotliDecompressSync(Buffer.from(encoded, "base64"), {maxOutputLength:150000});
    const tables = JSON.parse(decoded.toString("utf8")) as Factors;
    for (const term of [10,15,20]) for (const gender of ["M","F"] as Gender[]) {
      const data = tables[String(term)]?.[gender];
      if (!data || data.cv?.length !== 76 || data.rpu?.length !== 76)
        throw Error("incomplete legacy factor sources");
      for(let age=0;age<=75;age++){
        const cv=data.cv[age], rpu=data.rpu[age];
        if(!Array.isArray(cv)||cv.length!==Math.min(35,99-age)||
           cv.some(v=>!Number.isInteger(v)||v<0||v>3000)||
           !Array.isArray(rpu)||rpu.length!==term-1||
           rpu.some(v=>!Number.isInteger(v)||v<0||v>1000))
          throw Error("invalid legacy table scope");
      }
    }
    factorCache = tables;
    return tables;
  } catch {
    return null; // fail closed: no estimates, no cross-case substitution
  }
}

export async function GET(request:NextRequest) {
  // Independently verify an active internal user, even when middleware is bypassed.
  const sb=createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {cookies:{getAll:()=>request.cookies.getAll(),setAll:()=>{}}}
  );
  const {data:{user},error}=await sb.auth.getUser();
  if(error||!user) return NextResponse.json({error:"authentication_required"},{status:401,headers:noStore});
  const {data:profile,error:profileError}=await sb.from("user_profiles")
    .select("role,active").eq("user_id",user.id).maybeSingle();
  if(profileError||!profile||profile.active!==true||
     !["admin","manager","training"].includes(profile.role))
    return NextResponse.json({error:"not_authorized"},{status:403,headers:noStore});
  const query=request.nextUrl.searchParams;
  const gender=query.get("gender");
  const age=Number(query.get("age"));
  const sum=Number(query.get("sum"));
  const term=Number(query.get("term"));
  if((gender!=="M"&&gender!=="F")||!Number.isInteger(age)||age<0||age>75||
     !Number.isFinite(sum)||sum<10000000||sum>1000000000||![10,15,20].includes(term))
    return NextResponse.json({error:"invalid_case"},{status:400,headers:noStore});
  const factors=getVerifiedFactors();
  if(!factors) return NextResponse.json({error:"restricted_factors_not_configured"},{status:503,headers:noStore});
  const source=factors[String(term)][gender];
  const rows=Array.from({length:99-age},(_,i)=>{
    const cv=source.cv[age][i],rpu=source.rpu[age][i];
    const amount=(value:number|undefined)=>Number.isInteger(value)&&value>0
      ?Math.round(value*sum/1000):null;
    return {age:age+i,policyYear:i+1,surrender:amount(cv),paidUp:amount(rpu)};
  });
  return NextResponse.json({
    source:"AIA_AGENT_MANUAL_2025_INTERNAL_QA",
    gender, issueAge:age,term,sum,rows,
    notice:"Internal QA only; values not approved as an AIA sales illustration."
  },{headers:noStore});
}
