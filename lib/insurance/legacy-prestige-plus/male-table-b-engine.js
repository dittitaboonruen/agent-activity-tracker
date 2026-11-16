/**
 * AIA Legacy Prestige Plus (New) — male Table B isolated engine.
 * Does NOT contain or expose restricted AIA manual factor tables.
 * Inputs must be independently verified and authorized for this use.
 * Missing factors remain null; never interpolate or borrow.
 */
export const MALE_LEGACY_SCOPE = Object.freeze({
  plan: 'AIA_LEGACY_PRESTIGE_PLUS_NEW', gender: 'M', terms: [10,15,20],
});
const keys = ['cvPer1000','rpuPer1000','rpuImmediatePer1000',
  'etiYears','etiDays','etiMaturityPer1000','etiImmediatePer1000'];

export function calculateMaleLegacyTableB(input) {
  const {plan,gender,issueAge,sumAssured,premiumTerm,factorRows} = input || {};
  if(plan!==MALE_LEGACY_SCOPE.plan || gender!=='M' ||
     !MALE_LEGACY_SCOPE.terms.includes(premiumTerm) ||
     !Number.isInteger(issueAge)||issueAge<0||issueAge>75||
     !Number.isFinite(sumAssured)||sumAssured<10000000||
     sumAssured>1000000000||!Array.isArray(factorRows)) return null;
  const indexed=new Map();
  for(const row of factorRows) {
    if(row?.gender!=='M'||row?.premiumTerm!==premiumTerm||row?.issueAge!==issueAge)
      throw Error('Factor scope mismatch: rejected cross-sex, term, or issue-age row');
    const year=row.policyYear;
    if(!Number.isInteger(year)||year<1||year>99-issueAge)
      throw Error('Invalid policy year');
    if(indexed.has(year))throw Error('Duplicate factor policy year '+year);
    const checked={};
    for(const k of keys) {
      const value=row[k];
      if(value===null||value===undefined||value==='') {checked[k]=null;continue;}
      if(typeof value!=='number'||!Number.isFinite(value)||value<0)
        throw Error('Invalid factor '+k+' in year '+year);
      checked[k]=value;
    }
    if(checked.etiDays!==null&&(!Number.isInteger(checked.etiDays)||checked.etiDays>=366))
      throw Error('ETI days out of range');
    if(checked.etiYears!==null&&!Number.isInteger(checked.etiYears))
      throw Error('ETI years must be integer');
    indexed.set(year,checked);
  }
  const money=v=>v===null||v===0?null:Math.round(v*sumAssured/1000);
  const rows=[];
  for(let year=1;year<=99-issueAge;year++){
    const factors=indexed.get(year);
    rows.push({
      policyYear:year,age:issueAge+year-1,
      surrender:money(factors?.cvPer1000??null),
      paidUp:money(factors?.rpuPer1000??null),
      paidUpImmediate:money(factors?.rpuImmediatePer1000??null),
      extendedYears:factors?.etiYears??null,
      extendedDays:factors?.etiDays??null,
      extendedMaturity:money(factors?.etiMaturityPer1000??null),
      extendedImmediate:money(factors?.etiImmediatePer1000??null),
    });
  }
  return {plan,gender,premiumTerm,issueAge,sumAssured,rows,
    sourceStatus:'AUTHORIZED_FACTORS_REQUIRED'};
}
