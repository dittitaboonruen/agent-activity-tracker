/** 
 * Isolated Legacy Prestige Plus CV formula discovery. NOT a product quote.
 * Tables are provided at runtime; do not embed restricted AIA factors.
 * This module is NOT imported by the calculator API, screen or PDF.
 */
export function inspectAttainedAgeCv({cvRows, issueAge, attainedAge, payTerm, verifiedCv = null}) {
  const blocked = reason => ({status:'NEEDS_VERIFICATION', reason, amount:null});
  if (!Number.isInteger(issueAge)||issueAge<0||issueAge>75 ||
      !Number.isInteger(attainedAge)||attainedAge<issueAge||attainedAge>98 ||
      ![10,15,20].includes(payTerm) || !Array.isArray(cvRows)||cvRows.length!==76)
    return blocked('INVALID_INPUT');
  const year=attainedAge-issueAge+1;
  if (year<=35) return blocked('USE_VERIFIED_SOURCE_CELL');
  // 5,080/5,080 held-out known manual cells matched this model for
  // issue ages <=55, across 10/15/20 Pay and both sexes. No general proof.
  if(issueAge>55)return blocked('ISSUE_AGE_OUTSIDE_RESEARCH_COHORT');
  const anchorAge=attainedAge-34; // published table's end of policy year 35
  const partnerAge=attainedAge-33; // adjacent published policy year 34
  if(anchorAge<=issueAge||anchorAge<0||partnerAge>75)
    return blocked('NO_VALID_MANUAL_ANCHOR');
  const year35=cvRows[anchorAge]?.[34];
  const year34=cvRows[partnerAge]?.[33];
  if(!Number.isInteger(year35)||!Number.isInteger(year34)||year35<0||year34<0)
    return blocked('MISSING_SOURCE_FACTOR');
  if(year35!==year34)return blocked('CONFLICTING_SOURCE_FACTORS');
  if(verifiedCv!==null){
    if(!Number.isInteger(verifiedCv)||verifiedCv!==year35)return blocked('EXACT_REFERENCE_DISAGREEMENT');
  }
  return {
    status:'RESEARCH_CANDIDATE_NOT_APPROVED',reason:'YEAR35_YEAR34_CONSENSUS',
    factorPer1000:year35, amount:null,
    sourceIssueAges:[anchorAge,partnerAge],
    sourceYears:[35,34]
  };
}
