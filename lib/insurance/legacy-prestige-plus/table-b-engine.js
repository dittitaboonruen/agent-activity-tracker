/**
 * AIA Legacy Prestige Plus (New), Table B isolated calculation engine.
 * Source: AIA 2025 agent manual, CV p.18, ETI p.20, RPU p.22 (female 20-pay).
 * No imports or side effects. NOT called by other insurance products.
 * Agent manual explicitly forbids presenting these tables as official client quotations.
 * factor records must be independently checked against original manual.
 */
export const LEGACY_TABLE_B_SCOPE = Object.freeze({plan:'AIA_LEGACY_PRESTIGE_PLUS_NEW',gender:'F',premiumTerm:20});

function key(age,year){ return age+':'+year; }
function index(records,field){
  const m=new Map();
  for(const r of records){
    // Protect against accidentally passing male/other-term datasets.
    if(String(r.sex).toUpperCase()!=='F'||Number(r.premium_term)!==20)continue;
    const age=Number(r.issue_age),year=Number(r.policy_year);
    const v=r[field];
    if(Number.isInteger(age)&&Number.isInteger(year)&&v!==''&&v!==null&&v!==undefined){
      const num=Number(v);
      if(Number.isFinite(num)&&num>=0){const k=key(age,year);if(m.has(k))throw Error('Duplicate factor row '+k);m.set(k,num);}
    }
  }
  return m;
}
export function calculateLegacyFemale20PayTableB({plan,gender,issueAge,sumAssured,premiumTerm,cvRows,rpuRows,etiRows}){
  if(plan!==LEGACY_TABLE_B_SCOPE.plan||gender!=='F'||premiumTerm!==20) return null;
  if(!Number.isInteger(issueAge)||issueAge<0||issueAge>75||
     !Number.isFinite(sumAssured)||sumAssured<10000000) return null;
  if(!Array.isArray(cvRows)||!Array.isArray(rpuRows)||!Array.isArray(etiRows))return null;
  const cv=index(cvRows,'factor_per_1000');
  const rpu=index(rpuRows,'paid_up_factor_per_1000');
  const rpuImmediate=index(rpuRows,'immediate_payment_factor_per_1000');
  const etiYears=index(etiRows,'extended_years');
  const etiDays=index(etiRows,'extended_days');
  const etiMaturity=index(etiRows,'maturity_value_per_1000');
  const etiImmediate=index(etiRows,'immediate_value_per_1000');
  const amount=(m,k)=>m.has(k)&&m.get(k)>0?Math.round(m.get(k)*sumAssured/1000):null;
  const output=[];
  for(let year=1;year<=99-issueAge;year++){
    const k=key(issueAge,year);
    // AIA manual: policy year 1 corresponds issue age, year 2 => issueAge + 1.
    output.push({
      age:issueAge+year-1,policyYear:year,
      surrender:amount(cv,k),
      paidUp:amount(rpu,k),
      paidUpImmediate:amount(rpuImmediate,k),
      extendedYears:(etiYears.get(k)>0?etiYears.get(k):null),
      extendedDays:(etiYears.get(k)>0?etiDays.get(k)??null:null),
      extendedMaturity:amount(etiMaturity,k),
      extendedImmediate:amount(etiImmediate,k),
      source:'AIA_AGENT_MANUAL_2025',verifiedWithIpos:false
    });
  }
  return output;
}
