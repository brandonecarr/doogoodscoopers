import pg from 'pg';
const key = process.env.QUO_API_KEY, base="https://api.quo.com/v1";
const get = async (p)=>{const r=await fetch(base+p,{headers:{Authorization:key,Accept:"application/json"},cache:"no-store"});return {s:r.status,d:await r.json().catch(()=>null)};};
const norm = (s)=>{const d=String(s||"").replace(/\D/g,""); return d.length>=10 ? d.slice(-10) : "";};

// 1) ALL Quo contacts (paginate)
let contacts=[], token=null;
do {
  const r = await get(`/contacts?maxResults=50${token?`&pageToken=${encodeURIComponent(token)}`:""}`);
  if(r.s!==200){console.log("ERR",r.s,JSON.stringify(r.d).slice(0,200));break;}
  contacts.push(...(r.d.data||[])); token = r.d.nextPageToken||null;
} while(token && contacts.length<1000);
console.log("Total Quo contacts:", contacts.length);

// 2) Protected phones = ACTIVE Sweep&Go customers
const pool = new pg.Pool({connectionString: process.env.DIRECT_URL||process.env.DATABASE_URL});
const cust = await pool.query(`SELECT "firstName","lastName","cellPhone","homePhone" FROM "SweepandgoCustomer" WHERE active=true;`);
await pool.end();
const protectedPhones = new Set();
for(const c of cust.rows){ for(const p of [c.cellPhone,c.homePhone]){ const n=norm(p); if(n) protectedPhones.add(n); } }
console.log("Active customers:", cust.rows.length, "| protected phone numbers:", protectedPhones.size);

// 3) Classify
const del=[], keepCustomer=[], keepOther=[];
for(const c of contacts){
  const f=c.defaultFields||{};
  const name=[f.firstName,f.lastName].filter(Boolean).join(" ")||"(no name)";
  const phones=(f.phoneNumbers||[]).map(p=>p.value);
  const src=c.source||"";
  const row={id:c.id,name,phone:phones.join(","),src,created:(c.createdAt||"").slice(0,10)};
  if(!src.startsWith("DooGoodScoopers")){ keepOther.push(row); continue; }       // ios / public-api → untouched
  if(src==="DooGoodScoopers Client"){ keepCustomer.push({...row,why:"client record"}); continue; }
  if(phones.some(p=>protectedPhones.has(norm(p)))){ keepCustomer.push({...row,why:"active customer phone"}); continue; }
  del.push(row);
}
console.log(`\n=== WILL DELETE (${del.length}) — app-created LEAD contacts ===`);
for(const r of del) console.log(`  ✗ ${r.created} | ${r.src.padEnd(26)} | ${r.name} | ${r.phone}`);
console.log(`\n=== PROTECTED: current customers/clients (${keepCustomer.length}) ===`);
for(const r of keepCustomer) console.log(`  ✓ ${r.name} | ${r.phone} | ${r.why}`);
console.log(`\n=== UNTOUCHED: not created by our app (${keepOther.length}) ===`);
const bySrc={}; for(const r of keepOther) bySrc[r.src]=(bySrc[r.src]||0)+1;
console.log("  ", JSON.stringify(bySrc));
