/* Legacy Prestige Plus (New) — local-only authorized factor importer.
 * No network calls or persistent client storage. Never bundle AIA manual data.
 * Only the user's current browser tab holds the imported factors.
 */
(function(global){
  'use strict';
  const MAX_ROWS=18000;
  const MAX_BYTES=3*1024*1024;
  const FIELDS=['cvPer1000','rpuPer1000','rpuImmediatePer1000','etiYears','etiDays','etiMaturityPer1000','etiImmediatePer1000'];
  let factors=null;
  const key=(gender,term,issueAge,year)=>[gender,term,issueAge,year].join(':');
  function parse(text){
    if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('ไฟล์ข้อมูลเกิน 3MB');
    let parsed;
    try{parsed=JSON.parse(text);}catch{throw Error('กรุณาใช้ไฟล์ JSON ที่ถูกต้อง');}
    if(parsed?.plan!=='AIA_LEGACY_PRESTIGE_PLUS_NEW'||parsed?.usage!=='authorized-internal-qa'||!Array.isArray(parsed?.rows))
      throw Error('ข้อมูลไม่ใช่ Legacy Prestige Plus หรือยังไม่มีคำรับรองใช้งานภายใน');
    if(parsed.rows.length===0||parsed.rows.length>MAX_ROWS)throw Error('จำนวนแถวไม่ถูกต้อง');
    const result=new Map();
    for(const [i,row] of parsed.rows.entries()){
      if(!row||row.gender!=='M'||![10,15,20].includes(row.premiumTerm)||
         !Number.isInteger(row.issueAge)||row.issueAge<0||row.issueAge>75||
         !Number.isInteger(row.policyYear)||row.policyYear<1||row.policyYear>99-row.issueAge)
        throw Error('ข้อมูลเพศ/อายุ/ปีกรมธรรม์ไม่ถูกต้อง แถว '+(i+1));
      const k=key(row.gender,row.premiumTerm,row.issueAge,row.policyYear);
      if(result.has(k))throw Error('พบแถวซ้ำ '+k);
      const values={};
      for(const field of FIELDS){
        const v=row[field];
        if(v===null||v===undefined||v===''){values[field]=null;continue;}
        if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw Error('Factor '+field+' ไม่ถูกต้อง แถว '+(i+1));
        if((field==='etiYears'||field==='etiDays')&&!Number.isInteger(v))throw Error('ETI ต้องเป็นจำนวนเต็ม');
        if(field==='etiDays'&&v>365)throw Error('ETI วันต้องไม่เกิน 365');
        values[field]=v;
      }
      result.set(k,values);
    }
    return result;
  }
  function importText(text){const next=parse(text);factors=next;return next.size;}
  function clear(){factors=null;}
  function lookup(issueAge,gender,sum,term){
    if(gender!=='ชาย'||!factors||!Number.isInteger(issueAge)||issueAge<0||issueAge>75||
       !Number.isFinite(sum)||sum<10000000||sum>1000000000||![10,15,20].includes(term))return null;
    const byAge=new Map();
    const money=value=>value===null||value===undefined||value===0?null:Math.round(value*sum/1000);
    let matched=0;
    for(let year=1;year<=99-issueAge;year++){
      const x=factors.get(key('M',term,issueAge,year));
      if(!x)continue;
      matched++;
      byAge.set(issueAge+year-1,{
        age:issueAge+year-1,
        surrender:money(x.cvPer1000),paidUp:money(x.rpuPer1000),
        paidUpInstant:money(x.rpuImmediatePer1000),
        extendedYears:x.etiYears,extendedDays:x.etiDays,
        extendedMaturity:money(x.etiMaturityPer1000),
        extendedInstant:money(x.etiImmediatePer1000),
      });
    }
    return matched?{id:'local-import',mode:'local-internal-qa',sum,byAge,
      source:'ไฟล์ Factor ภายในที่ผู้ใช้เลือกเอง (ยังต้องตรวจสอบกับ AIA iPOS+)'}:null;
  }
  global.RP_LEGACY_LOCAL_TABLE_B=Object.freeze({
    importText,clear,lookup,count:()=>factors?.size||0
  });
})(window);
