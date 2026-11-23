/**
 * QA-only verified-value provenance for Legacy Prestige Plus (New).
 *
 * This module NEVER calculates, estimates or extrapolates CV.  It only
 * classifies the source of the amount the existing API already computed.
 * Research candidates must not be surfaced as verified values.
 */
export type CvEvidenceStatus = "MANUAL_PUBLISHED" | "IPOS_EXACT_CASE_QA" | "UNAVAILABLE";

export function classifyLegacyCvEvidence(input: {
  gender: "M" | "F";
  issueAge: number;
  term: 10 | 15 | 20;
  sum: number;
  attainedAge: number;
  publishedAmount: number | null;
  exactScreenshotAmount: number | null;
}): CvEvidenceStatus {
  const {gender,issueAge,term,sum,attainedAge,publishedAmount,exactScreenshotAmount}=input;
  if(Number.isSafeInteger(publishedAmount)&&publishedAmount!==null&&publishedAmount>=0)
    return "MANUAL_PUBLISHED";
  const isFemaleCase=gender==="F"&&issueAge===35&&term===15&&sum===10000000&&
    attainedAge>=70&&attainedAge<=98;
  const isMaleCase=gender==="M"&&issueAge===40&&term===10&&sum===10000000&&
    attainedAge>=75&&attainedAge<=98;
  if((isFemaleCase||isMaleCase)&&Number.isSafeInteger(exactScreenshotAmount)&&
     exactScreenshotAmount!==null&&exactScreenshotAmount>=0)
    return "IPOS_EXACT_CASE_QA";
  return "UNAVAILABLE";
}
