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
  try {
    let tables: Factors;
    if (encoded) {
      const decoded = brotliDecompressSync(Buffer.from(encoded,"base64"),{maxOutputLength:150000});
      tables = JSON.parse(decoded.toString("utf8")) as Factors;
    } else {
      // Small private datasets; NEVER read the old public female scripts.
      const maleCvEncoded=process.env.LEGACY_TABLE_B_MALE_CV_BR_B64;
      const maleRpuEncoded=process.env.LEGACY_RPU_MALE_FACTORS_BR_B64;
      const femaleEncoded=process.env.LEGACY_TABLE_B_FEMALE_U16_B64;
      if(!maleCvEncoded||!maleRpuEncoded||!femaleEncoded)return null;
      const maleCv=JSON.parse(brotliDecompressSync(Buffer.from(maleCvEncoded,"base64"),
        {maxOutputLength:60000}).toString("utf8")) as Record<string,number[][]>;
      const maleRpu=JSON.parse(brotliDecompressSync(Buffer.from(maleRpuEncoded,"base64"),
        {maxOutputLength:60000}).toString("utf8")) as Record<string,number[][]>;
      const binary=Buffer.from(femaleEncoded,"base64");
      if(binary.length!==21948)return null;
      let position=0;
      const take=(length:number)=>{
        const row:number[]=[];
        for(let i=0;i<length;i++){
          if(position+2>binary.length)throw Error("female factor data truncated");
          row.push(binary.readUInt16LE(position));position+=2;
        }
        return row;
      };
      tables={};
      for(const term of [10,15,20]){
        const female={cv:[] as number[][],rpu:[] as number[][]};
        for(const kind of ["cv","rpu"] as const){
          for(let age=0;age<=75;age++)
            female[kind].push(take(kind==="cv"?Math.min(35,99-age):term-1));
        }
        const mRpu=maleRpu[String(term)];
        if(!Array.isArray(mRpu)||mRpu.length!==76)return null;
        tables[String(term)]={
          M:{cv:maleCv[String(term)],rpu:mRpu.map((r,age)=>{
            if(!Array.isArray(r)||r[0]!==age||r.length!==term)throw Error("male RPU row mismatch");
            return r.slice(1);
          })},
          F:female,
        };
      }
      if(position!==binary.length)throw Error("female factor data overflow");
    }
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
    const amount=(value:number|undefined)=>typeof value==="number"&&Number.isInteger(value)&&value>0
      ?Math.round(value*sum/1000):null;
    return {age:age+i,policyYear:i+1,surrender:amount(cv),paidUp:amount(rpu)};
  });
  return NextResponse.json({
    source:"AIA_AGENT_MANUAL_2025_INTERNAL_QA",
    gender, issueAge:age,term,sum,rows,
    notice:"Internal QA only; values not approved as an AIA sales illustration."
  },{headers:noStore});
}
