/**
 * INTERNAL RESEARCH ONLY — AIA Legacy Prestige Plus (New).
 * Do not call from the customer-facing Table B API or PDF generator.
 * Manual CV has policy years 1..35; this helper checks consistency of
 * same-gender, same-pay-term, same-attained-age source factors.
 * Matching factors are RESEARCH CANDIDATES, never an insurer-approved CV.
 *
 * Raw, restricted factor matrices must remain server-side / encrypted.
 */
export type LegacyCvResearchResult =
  | { status: "needs_source"; donorCount: number }
  | { status: "conflicting_factors"; donorCount: number; distinctFactors: number }
  | { status: "research_candidate_not_verified"; donorCount: number; factor: number; sourcePolicyYears: number[] };

export function researchCvAttainedAgeLookup(
  cvRows: readonly (readonly number[])[],
  originalIssueAge: number,
  attainedAge: number,
  payTerm: 10 | 15 | 20,
): LegacyCvResearchResult {
  if (!Number.isInteger(originalIssueAge) || originalIssueAge < 0 || originalIssueAge > 75 ||
      !Number.isInteger(attainedAge) || attainedAge < originalIssueAge || attainedAge > 98 ||
      ![10,15,20].includes(payTerm) || !Array.isArray(cvRows) || cvRows.length !== 76) {
    return {status: "needs_source", donorCount: 0};
  }
  // Never substitute for an original published table cell.
  const actualYear = attainedAge - originalIssueAge + 1;
  if (actualYear <= 35) return {status: "needs_source", donorCount: 0};

  const donors: {factor:number; policyYear:number}[] = [];
  for (let issueAge = originalIssueAge + 1; issueAge <= 75; issueAge++) {
    const policyYear = attainedAge - issueAge + 1;
    if (policyYear <= payTerm || policyYear > 35) continue;
    const row = cvRows[issueAge];
    const factor = Array.isArray(row) ? row[policyYear-1] : undefined;
    if (Number.isInteger(factor) && factor! >= 0) donors.push({factor:factor!,policyYear});
  }
  if (donors.length < 2) return {status:"needs_source",donorCount:donors.length};
  const unique = new Set(donors.map(d=>d.factor));
  if (unique.size !== 1) return {
    status:"conflicting_factors",donorCount:donors.length,distinctFactors:unique.size
  };
  return {status:"research_candidate_not_verified",donorCount:donors.length,
    factor:donors[0].factor,sourcePolicyYears:donors.map(d=>d.policyYear)};
}
