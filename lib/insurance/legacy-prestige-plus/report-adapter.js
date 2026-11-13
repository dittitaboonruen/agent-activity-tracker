/**
 * Table B / report unified projection, AIA Legacy Prestige Plus only.
 * Input MUST be rows returned from calculateLegacyFemale20PayTableB.
 * No UI hooks or other-plan dependencies. Internal QA, not sales quotation.
 */
const REPORT_YEARS = Object.freeze([1,2,3,5,10,15,20,25,30,35]);
export function buildLegacyTableBReportProjection({plan,gender,premiumTerm,issueAge,sumAssured,tableBRows}){
  if(plan!=='AIA_LEGACY_PRESTIGE_PLUS_NEW'||gender!=='F'||premiumTerm!==20) return null;
  if(!Number.isInteger(issueAge)||!Number.isFinite(sumAssured)||!Array.isArray(tableBRows)) return null;
  const byYear=new Map(tableBRows.map(row=>[row.policyYear,row]));
  return {
    plan,gender,issueAge,sumAssured,premiumTerm,source:'AIA_AGENT_MANUAL_2025_QA',
    items:REPORT_YEARS.filter(y=>byYear.has(y)).map(year=>{
      const row=byYear.get(year);
      return {policyYear:year,age:row.age,surrender:row.surrender,
        paidUp:row.paidUp,paidUpImmediate:row.paidUpImmediate,
        extendedYears:row.extendedYears,extendedDays:row.extendedDays,
        extendedMaturity:row.extendedMaturity,extendedImmediate:row.extendedImmediate};
    })
  };
}
