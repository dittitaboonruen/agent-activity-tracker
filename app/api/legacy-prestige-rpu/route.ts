import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { brotliDecompressSync } from "node:zlib";
import { createHash } from "node:crypto";
import { hasCalculatorAccess } from "@/lib/insurance/legacy-prestige-plus/calculator-access";

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

// SHA-256 of JSON.stringify(row arrays) for each CV/RPU table, extracted from
// the supplied AIA 2025 manual, independently cross-read by PyMuPDF/pdfplumber.
// Only integrity fingerprints are committed. NEVER commit raw restricted factors.
// RPU fingerprint covers first numeric component; second RPU component has
// unresolved interpretation in 206 source cells and needs AIA confirmation.
const LEGACY_MANUAL_FACTOR_SHA256: Record<string,{cv:string;rpu:string}> = {
  "10:M":{cv:"201928f145da0fb9cd99680aca8013e6374dc64f39298887f7a7d22f5d62617d",rpu:"3046546a7a225f45e24369829be08edcb396f8bc08a0741485edb39f5bff14de"},
  "10:F":{cv:"54ea70c3199f93026bed7ded39ff23d188ba6a31511fc46ce581dd87da760151",rpu:"0c1611d33e01a8b05e5249d87b053ae3768fd26026bc81d1351953251c76e779"},
  "15:M":{cv:"d77666791de7ccfe96c042da88b155c49336b9142cea9630cbd1fa0e0f0bb6c0",rpu:"eb3b0897a680dc408645e9631887976f28887a6bdda0c91bb15cb4ede6096c8e"},
  "15:F":{cv:"4fcc70884e18f89449c4419f286c34bfc84865eddfaafb81824097d9d2b51af9",rpu:"c21d30236409ee6898d8cb0073092ee6e1932ff90d82fdb421b6c118bdd29edc"},
  "20:M":{cv:"d5ef25d85f1fdd00e96234e7d583a135e5c2ce87fdc494fb3ce07ec34ce6d72f",rpu:"a217c391778de7084fc4d7cbef8309e835f54fd820d496028b8cc6c0d3ab2ae0"},
  "20:F":{cv:"2543e7adacd5023b29b0b6b614ddd5883ecc5e2f5eaf37b6aad0281a585dbbea",rpu:"8410df92606f5ca7c6898bcd00381ebab32a7a3a027b033d7a64fda5bfa897aa"},
};
// Manual RPU display cells with a nonzero *second* numeric segment.
// Until AIA confirms its meaning, do NOT present the first segment as a
// complete paid-up sum for these 206 age/policy-year positions.
// Only position bitmasks are committed, never raw proprietary factors.
const LEGACY_RPU_UNRESOLVED_SEGMENT_BITS: Record<string,Record<number,number>> = {
  "10:M":{69:256,70:256,71:256,72:256,73:384,74:384,75:384},
  "10:F":{72:256,73:256,74:256,75:384},
  "15:M":{66:8192,67:8192,68:12288,69:14336,70:14336,71:15360,72:15360,73:15872,74:15872,75:15872},
  "15:F":{68:8192,69:12288,70:12288,71:12288,72:14336,73:15360,74:15360,75:15872},
  "20:M":{60:262144,61:262144,62:262144,63:393216,64:393216,65:393216,66:458752,67:491520,68:491520,69:516096,70:520192,71:522240,72:522240,73:523264,74:523264,75:523776},
  "20:F":{63:262144,64:262144,65:393216,66:393216,67:458752,68:491520,69:507904,70:507904,71:516096,72:516096,73:520192,74:522240,75:522240},
};
let factorCache: Factors | null = null;
// Keep diagnostic information coarse: never serialize factors, hash values or secrets.
let factorHealthCode: "not_checked" | "missing_configuration" | "validation_failed" | "verified" = "not_checked";

function getVerifiedFactors(): Factors | null {
  if (factorCache) { factorHealthCode = "verified"; return factorCache; }
  factorHealthCode = "validation_failed";
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
      if(!maleCvEncoded||!maleRpuEncoded||!femaleEncoded){
        factorHealthCode = "missing_configuration";
        return null;
      }
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
      // Corrected male 20-pay RPU from uploaded 2025 manual, private Preview env only.
      // 10/15 Pay remain exactly as previously verified.
      const male20=process.env.LEGACY_RPU_MALE_20_CORRECTED_BR_B64;
      if(male20){
        const rows=JSON.parse(brotliDecompressSync(Buffer.from(male20,"base64"),
          {maxOutputLength:30000}).toString("utf8")) as number[][];
        tables["20"].M.rpu=rows;
      }

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
    // Fail closed if *any* decoded factor differs from the manual's audited cells.
    // No raw factors or their full table rows are logged or exposed to clients.
    for(const term of [10,15,20]) for(const gender of ["M","F"] as Gender[]){
      const digest=LEGACY_MANUAL_FACTOR_SHA256[`${term}:${gender}`];
      for(const kind of ["cv","rpu"] as const){
        const actual=createHash("sha256")
          .update(JSON.stringify(tables[String(term)][gender][kind]))
          .digest("hex");
        if(!digest||actual!==digest[kind])
          throw Error("legacy manual factor integrity mismatch");
      }
    }
    factorCache = tables;
    factorHealthCode = "verified";
    return tables;
  } catch {
    return null; // fail closed: no estimates, no cross-case substitution
  }
}

export async function GET(request:NextRequest) {
  const query=request.nextUrl.searchParams;
  // Customer-facing calculator access is independent of the operations
  // dashboard login. The cookie is signed, short-lived and HttpOnly.
  // The privileged selfTest remains exclusive to authenticated admin/training.
  const calculatorAccess=query.get("selfTest")!=="1" && hasCalculatorAccess(request);
  if(!calculatorAccess){
    const sb=createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {cookies:{getAll:()=>request.cookies.getAll(),setAll:()=>{}}}
    );
    const {data:{user},error}=await sb.auth.getUser();
    if(error||!user)
      return NextResponse.json({error:"authentication_required"},{status:401,headers:noStore});
    const {data:profile,error:profileError}=await sb.from("user_profiles")
      .select("role,active").eq("user_id",user.id).maybeSingle();
    if(profileError||!profile||profile.active!==true||
       !["admin","manager","training"].includes(profile.role))
      return NextResponse.json({error:"not_authorized"},{status:403,headers:noStore});
    if(query.get("selfTest")==="1"){
      if(!["admin","training"].includes(profile.role))
        return NextResponse.json({error:"not_authorized"},{status:403,headers:noStore});
      const verified=!!getVerifiedFactors();
      const groups=([10,15,20] as const).flatMap(term=>
        (["M","F"] as const).map(gender=>({
          term,gender,status:verified?"PASS":"BLOCKED"
        }))
      );
      return NextResponse.json({
        check:"legacy_table_b_integrity",
        result:verified?"PASS":"BLOCKED",
        reason:verified?"verified":factorHealthCode,
        groups,
        note:"Internal factor integrity only; not a product approval or insurer quotation."
      },{status:verified?200:503,headers:noStore});
    }
  }
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
  const unresolvedRpuBits=LEGACY_RPU_UNRESOLVED_SEGMENT_BITS[`${term}:${gender}`]?.[age]||0;
  // QA ONLY: exact-case CV numbers transcribed from the operator's iPOS+
  // screenshots (ages 70..98). Not general insurer factors; do not commit
  // source amounts or extrapolate to any other sex, age, term or sum.
  let exactCaseCv: number[] | null = null;
  if(gender==="F"&&age===35&&term===15&&sum===10000000){
    const raw=process.env.LEGACY_QA_CV_F_35_15_10M_70_98_JSON;
    if(raw){
      try{
        const values:unknown=JSON.parse(raw);
        if(Array.isArray(values)&&values.length===29&&
           values.every((v,i)=>Number.isSafeInteger(v)&&v>=0&&v<=sum&&v%10000===0&&
             (i===0||v>=values[i-1]))&&
           values[0]===5840000&&values[20]===8560000&&
           values[28]===sum)
          exactCaseCv=values as number[];
      }catch{}
      if(!exactCaseCv)
        return NextResponse.json({error:"exact_case_cv_validation_failed"},
          {status:503,headers:noStore});
    }
  }

  // Screenshot-backed CV only for male issue40 / 10 Pay / SI10m, attained 75..98.
  // This is NOT an interpolated factor and cannot apply to other cases.
  let male40ScreenshotCv: number[] | null = null;
  if(gender==="M"&&age===40&&term===10&&sum===10000000){
    const raw=process.env.LEGACY_QA_CV_M_40_10_10M_75_98_JSON;
    if(!raw)
      return NextResponse.json({error:"exact_case_cv_not_configured"},{status:503,headers:noStore});
    try {
      const values: unknown=JSON.parse(raw);
      if(Array.isArray(values)&&values.length===24 &&
         values.every((v,i)=>Number.isSafeInteger(v)&&v>=0&&v<=sum&&v%10000===0&&
           (i===0||v>=values[i-1])) &&
         createHash("sha256").update(JSON.stringify(values)).digest("hex")===
           "5dc18a4e74b031fdd7b2974832a6fa434fd42c8f82881d4527fe91ca013307bc")
        male40ScreenshotCv=values as number[];
    }catch{}
    if(!male40ScreenshotCv)
      return NextResponse.json({error:"exact_case_cv_validation_failed"},{status:503,headers:noStore});
  }
  // For policy years 36+, research an attained-age factor against the
  // manual's last published policy year (35). A second independent donor
  // (policy year 34) MUST agree; otherwise fail closed. The output is
  // explicitly unverified and is never substituted into surrender/PDF.
  const cvResearchCandidate=(attainedAge:number):number|null=>{
    const donorAge=attainedAge-34;
    const nextAge=donorAge+1;
    if(donorAge<=age||donorAge<0||nextAge>75)return null;
    const year35=source.cv[donorAge]?.[34];
    const year34=source.cv[nextAge]?.[33];
    if(!Number.isInteger(year35)||!Number.isInteger(year34)||year35!==year34)return null;
    return Math.round(year35*sum/1000);
  };
  const rows=Array.from({length:99-age},(_,i)=>{
    const cv=source.cv[age][i],rpu=source.rpu[age][i];
    // A source factor of 0 is a known zero, NOT an unavailable/missing value.
    const amount=(value:number|undefined)=>typeof value==="number"&&Number.isInteger(value)&&value>=0
      ?Math.round(value*sum/1000):null;
    const unresolvedRpu=i<term-1 && Boolean(unresolvedRpuBits & (1<<i));
    const attainedAge=age+i;
    const verifiedCv=amount(cv);
    const exactCv=exactCaseCv&&attainedAge>=70&&attainedAge<=98
      ?exactCaseCv[attainedAge-70]:null;
    const male40Cv=male40ScreenshotCv&&attainedAge>=75&&attainedAge<=98
      ?male40ScreenshotCv[attainedAge-75]:null;
    const screenshotCv=exactCv!==null?exactCv:male40Cv;
    const verifiedSurrender=verifiedCv===null&&screenshotCv!==null?screenshotCv:verifiedCv;
    const cvCandidate=verifiedSurrender===null&&i>=35
      ?cvResearchCandidate(attainedAge):null;
    return {age:attainedAge,policyYear:i+1,
      surrender:verifiedSurrender,
      cvResearchCandidate:cvCandidate,
      paidUp:unresolvedRpu?null:amount(rpu)};
  });
  return NextResponse.json({
    source:"AIA_AGENT_MANUAL_2025_INTERNAL_QA",
    gender, issueAge:age,term,sum,rows,
    cvExactCaseSource:(exactCaseCv||male40ScreenshotCv)?"USER_SUPPLIED_IPOS_SCREENSHOT_QA_ONLY":null,
    cvResearchMethod:"MANUAL_ATTAINED_AGE_YEAR35_34_AGREEMENT_UNVERIFIED",
    notice:"Internal QA only. cvResearchCandidate is not verified by iPOS+, is NOT surrender, and must not be exported to sales PDFs."
  },{headers:noStore});
}
