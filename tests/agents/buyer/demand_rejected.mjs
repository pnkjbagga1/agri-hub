import "dotenv/config";
import pg from "pg";
const B = "http://localhost:3100", PW = "AgriHub-Demo-2026";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
async function login(email) { const r = await fetch(B + "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PW, portal: "member" }) }); return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "); }
const call = async (ck, m, p, b) => { const r = await fetch(B + p, { method: m, headers: { cookie: ck, "content-type": "application/json" }, body: b && JSON.stringify(b) }); return [r.status, await r.text()]; };
const buyer = await login("buyer@agrihub.test"), grower = await login("grower@agrihub.test");
let [s, t] = await call(buyer, "POST", "/api/v1/demand", { title: "QA demand rejected " + Date.now(), produce: "Kale", category: "vegetable", quantity: 5, unit: "kg", frequency: "one_time", neededBy: null });
console.log("create", s, t);
const id = JSON.parse(t).id;
await db.query(`update "DemandPost" set approval='rejected' where id=$1`, [id]);
[s, t] = await call(grower, "POST", `/api/v1/demand/${id}`, { message: "offer on rejected post" });
console.log("offer on rejected", s, t);
[s] = await call(grower, "GET", `/demand/${id}`);
console.log("grower GET /demand/<rejected>", s);
await db.query(`update "DemandPost" set "isOpen"=false where id=$1`, [id]);
await db.end();
