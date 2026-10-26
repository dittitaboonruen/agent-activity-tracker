import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: Record<string,unknown>, status:number) => NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});

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
 // Read only the most recent timestamp per known table. No agent rows or scores leave this API.
 let skool: {module:string;status:string;latestObservedAtUTC?:string;reason?:string;recordCount?:number} = {module:"skool_learning",status:"unknown",reason:"query_unavailable"};
 let quiz: {module:string;status:string;latestObservedAtUTC?:string;reason?:string;recordCount?:number} = {module:"google_forms_quiz",status:"unknown",reason:"query_unavailable"};
 let pepObservation: {module:string;status:string;latestObservedAtUTC?:string;reason?:string}={module:"agent_pep",status:"unknown",reason:"query_unavailable"};
 let targetObservation: {module:string;status:string;latestObservedAtUTC?:string;reason?:string}={module:"annual_targets",status:"unknown",reason:"query_unavailable"};
 try {
   const db=getSupabaseClient();
   const [members,results,pep,targets,skoolCount,quizCount]=await Promise.all([
     db.from("learning_course_progress").select("synced_at").not("synced_at","is",null).order("synced_at",{ascending:false}).limit(1),
     db.from("learning_quiz_results").select("submitted_at").not("submitted_at","is",null).order("submitted_at",{ascending:false}).limit(1),
     db.from("pep_notes").select("updated_at").not("updated_at","is",null).order("updated_at",{ascending:false}).limit(1),
     db.from("agent_targets").select("updated_at").not("updated_at","is",null).order("updated_at",{ascending:false}).limit(1),
     db.from("learning_course_progress").select("id",{count:"exact",head:true}),
     db.from("learning_quiz_results").select("id",{count:"exact",head:true}),
   ]);
   const timestampOnly=(module:string,result:{data?:{updated_at?:string|null}[]|null;error?:unknown})=>
     result.error?{module,status:"unknown",reason:"query_failed"}:
     result.data?.[0]?.updated_at?{module,status:"timestamp_observed",latestObservedAtUTC:result.data[0].updated_at}:
     {module,status:"not_connected",reason:"no_timestamp"};
   pepObservation=timestampOnly("agent_pep",pep);
   targetObservation=timestampOnly("annual_targets",targets);
   skool=members.error?{module:"skool_learning",status:"unknown",reason:"query_failed"}:
     members.data?.[0]?.synced_at?{module:"skool_learning",status:"timestamp_observed",latestObservedAtUTC:members.data[0].synced_at}:
     {module:"skool_learning",status:"not_connected",reason:"no_sync_timestamp"};
   if(!skoolCount.error && typeof skoolCount.count==="number" && skoolCount.count>=0){skool={...skool,recordCount:skoolCount.count};}
   quiz=results.error?{module:"google_forms_quiz",status:"unknown",reason:"query_failed"}:
     results.data?.[0]?.submitted_at?{module:"google_forms_quiz",status:"timestamp_observed",latestObservedAtUTC:results.data[0].submitted_at}:
     {module:"google_forms_quiz",status:"not_connected",reason:"no_submission_timestamp"};
   if(!quizCount.error && typeof quizCount.count==="number" && quizCount.count>=0){quiz={...quiz,recordCount:quizCount.count};}
 } catch {
   // Fail closed. Do not disclose DB configuration, table schemas, or error text.
 }
 return json({
  service:"agent-activity-tracker",
  status:"observations_only",
  scope:"latest_stored_record_timestamps_not_workflow_health",
  checkedAtUTC:new Date().toISOString(),
  modules:[skool,quiz,pepObservation,targetObservation],
 },200);
}
export async function POST(){return json({error:"Method not allowed"},405);}
