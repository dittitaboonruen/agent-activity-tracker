import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: Record<string,unknown>, status:number) => NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
const MODULES = ["skool_learning","google_forms_quiz","agent_pep","annual_targets"] as const;

/**
 * Monitoring contract only. No existing source exposes a verified last-successful
 * sync or end-to-end execution marker. Never infer success from a table's existence,
 * public website reachability, or generic app liveness.
 */
export async function GET(request:NextRequest){
 const secret=process.env.HQ_MONITORING_SECRET;
 if(!secret || secret.length<32)return json({status:"not_connected"},503);
 const supplied=request.headers.get("authorization");
 if(!supplied?.startsWith("Bearer "))return json({error:"Unauthorized"},401);
 const token=supplied.slice(7);
 if(!token || token.length>2048)return json({error:"Unauthorized"},401);
 const digest=(v:string)=>createHash("sha256").update(v,"utf8").digest();
 if(!timingSafeEqual(digest(token),digest(secret)))return json({error:"Unauthorized"},401);
 return json({
  service:"agent-activity-tracker",
  status:"not_verified",
  scope:"workflow_verification_unavailable",
  checkedAtUTC:new Date().toISOString(),
  modules:MODULES.map(module=>({module,status:"not_connected",reason:"no_verified_read_only_freshness_signal"})),
 },200);
}
export async function POST(){return json({error:"Method not allowed"},405);}
