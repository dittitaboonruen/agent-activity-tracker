import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { brotliDecompressSync } from "node:zlib";

export const runtime="nodejs";
export const dynamic="force-dynamic";

// Internal staff QA ONLY. Factors are NOT bundled into public scripts or git.
// Vercel encrypted Preview environment: LEGACY_RPU_MALE_FACTORS_BR_B64.
// Source AIA Legacy Prestige Plus (New) internal 2025 manual sample RPU tables,
// male 10/15/20 pay. Never use the manual for a client quotation.
type FactorRows=Record<string,number[][]>;
let parsedFactors:FactorRows|null=null;
function getFactors():FactorRows|null{
  if(parsedFactors)return parsedFactors;
  const encoded=process.env.LEGACY_RPU_MALE_FACTORS_BR_B64;
  if(!encoded)return null;
  try{
    const decoded=brotliDecompressSync(Buffer.from(encoded,"base64"),{maxOutputLength:60000});
    const data=JSON.parse(decoded.toString("utf8")) as FactorRows;
    for(const term of ["10","15","20"]){
      const rows=data[term];
      if(!Array.isArray(rows)||rows.length!==76)throw Error("missing RPU source rows");
      for(let age=0;age<=75;age++){
        const r=rows[age];
        if(!Array.isArray(r)||r.length!==Number(term)||r[0]!==age||
           r.slice(1).some(v=>!Number.isInteger(v)||v<0||v>1000))
          throw Error("invalid RPU dataset at "+term+"/"+age);
      }
    }
    parsedFactors=data;
    return data;
  }catch{
    return null;
  }
}
const noStore={"Cache-Control":"private, no-store, max-age=0","X-Robots-Tag":"noindex, noarchive"};
export async function GET(request:NextRequest){
  // The middleware checks authentication; this route independently enforces
  // an active staff profile. No cross-user state, no mutation or raw factors.
  const sb=createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {cookies:{
      getAll:()=>request.cookies.getAll(),
      setAll:()=>{},
    }}
  );
  const {data:{user},error}=await sb.auth.getUser();
  if(error||!user)return NextResponse.json({error:"authentication_required"},{status:401,headers:noStore});
  const {data:profile,error:profileError}=await sb.from("user_profiles")
    .select("role,active").eq("user_id",user.id).maybeSingle();
  if(profileError||!profile||profile.active!==true||!["admin","manager"].includes(profile.role))
    return NextResponse.json({error:"not_authorized"},{status:403,headers:noStore});
  const term=Number(request.nextUrl.searchParams.get("term"));
  const issueAge=Number(request.nextUrl.searchParams.get("age"));
  const sum=Number(request.nextUrl.searchParams.get("sum"));
  if(![10,15,20].includes(term)||!Number.isInteger(issueAge)||issueAge<0||issueAge>75||
     !Number.isFinite(sum)||sum<10000000||sum>1000000000)
    return NextResponse.json({error:"invalid_case"},{status:400,headers:noStore});
  const factors=getFactors();
  if(!factors)return NextResponse.json({error:"restricted_factors_not_configured"},{status:503,headers:noStore});
  const row=factors[String(term)][issueAge];
  const rows=row.slice(1).map((factor,i)=>({
    age:issueAge+i,
    policyYear:i+1,
    paidUp:factor===0?null:Math.round(factor*sum/1000),
  }));
  return NextResponse.json({source:"AIA_AGENT_MANUAL_2025_INTERNAL_QA",gender:"M",
    issueAge,term,sum,rows,notice:"Internal QA only. Not an AIA client quotation."},{headers:noStore});
}
