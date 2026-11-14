// QA: grower onboarding + listings acceptance checks. Run from project root: node tests/agents/grower/grower-qa.mjs
import "dotenv/config";
import pg from "pg";
import { readFileSync } from "node:fs";
import zlib from "node:zlib";

const BASE = "http://localhost:3100";
const PW = (readFileSync("prisma/seed.ts", "utf8").match(/DEMO_PASSWORD = (?:process\.env\.SEED_PASSWORD \|\| )?"([^"]+)"/) || [])[1];
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const results = [];
const rec = (id, ok, note = "") => { results.push({ id, ok, note }); console.log(`${ok ? "PASS" : "FAIL"} ${id} ${note}`); };

class Agent {
  constructor() { this.jar = {}; }
  cookie() { return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; "); }
  async req(method, path, body, extra = {}) {
    const headers = { cookie: this.cookie(), ...(extra.headers || {}) };
    let payload = body;
    if (body !== undefined && !(body instanceof Uint8Array) && typeof body !== "string") { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const r = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
    for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); this.jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text, location: r.headers.get("location") };
  }
}

function png() {
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.from([0, 200, 30, 30]))), chunk("IEND", Buffer.alloc(0))]);
}
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

async function upload(a, kind, ct, bytes) {
  const s = await a.req("POST", "/api/v1/uploads/sign", { kind, contentType: ct, size: bytes.length });
  if (s.status !== 200) return { err: `sign ${s.status} ${s.text}` };
  const p = await fetch(BASE + s.json.uploadUrl, { method: "PUT", headers: { "content-type": ct, cookie: a.cookie() }, body: bytes });
  if (p.status !== 200) return { err: `put ${p.status} ${await p.text()}` };
  return { url: s.json.publicUrl };
}

const rnd = Math.random().toString(36).slice(2, 8);
const UNIQ = `zqx${rnd}berry`;
const region = (await db.query(`select id, slug from "Region" where slug='fraser-valley'`)).rows[0];
const otherRegion = (await db.query(`select id, slug from "Region" where slug<>'fraser-valley' and "isActive" limit 1`)).rows[0];
const moderation = (await db.query(`select * from "SiteSetting"`).catch(() => ({ rows: [] }))).rows;
console.log("region", region, "other", otherRegion?.slug, "settings", JSON.stringify(moderation));

// ---------- 1 ----------
const g = new Agent();
const email = `qa-grower-${rnd}@example.test`;
const su = await g.req("POST", "/api/v1/auth/signup", { role: "grower", orgName: `QA Farm ${rnd}`, contactName: "QA Tester", email, phone: "+1 604 555 0101", city: "Abbotsford", regionId: region.id, password: `Qa-${rnd}-Strong!Pass9`, acceptTerms: true });
rec("1a signup", su.status === 200 && su.json?.next === "/onboarding", `${su.status} ${su.text.slice(0, 120)}`);
const d0 = await g.req("GET", "/dashboard");
rec("1b /dashboard -> /onboarding", [307, 302, 303].includes(d0.status) && /onboarding/.test(d0.location ?? ""), `${d0.status} ${d0.location}`);
const baseListing = () => ({ title: `Fresh ${UNIQ} blueberries`, produce: "Blueberries", category: "berries", description: "QA listing", volume: 500, unit: "kg", price: 4.5, priceUnit: "kg", pricingMethod: "fixed", harvestStart: new Date(Date.now() + 86400e3 * 10).toISOString(), harvestEnd: new Date(Date.now() + 86400e3 * 40).toISOString(), status: "active", photos: ["/seed/x.png"] });
const l0 = await g.req("POST", "/api/v1/listings", baseListing());
rec("1c listing before photo 403", l0.status === 403 && /profile photo/i.test(l0.json?.error ?? ""), `${l0.status} ${l0.json?.error}`);

// ---------- 2 ----------
const av = await upload(g, "avatar", "image/png", png());
rec("2a avatar upload", !!av.url, av.err ?? av.url);
const profBody = (photoUrl) => ({ orgName: `QA Farm ${rnd}`, contactName: "QA Tester", tagline: "QA", photoUrl, city: "Abbotsford", regionId: region.id, certifications: ["organic", "buy_bc"], specialties: ["blueberries"] });
const pu = await g.req("PUT", "/api/v1/profile", profBody(av.url));
rec("2b profile PUT", pu.status === 200 && pu.json?.ok, `${pu.status} ${pu.text.slice(0, 120)}`);
const slug = pu.json?.slug;
const d1 = await g.req("GET", "/dashboard");
rec("2c /dashboard 200", d1.status === 200, `${d1.status} ${d1.location ?? ""}`);
const anon = new Agent();
const dir = await anon.req("GET", `/directory/${slug}`);
rec("2d /directory/<slug> shows org", dir.status === 200 && dir.text.includes(`QA Farm ${rnd}`), `${dir.status}`);

// ---------- 3 ----------
const ev = await g.req("PUT", "/api/v1/profile", profBody("https://evil.example/x.png"));
rec("3 evil photoUrl 422", ev.status === 422, `${ev.status} ${JSON.stringify(ev.json?.fields)}`);
for (const bad of ["/media/../../etc/passwd", "/seed/x.png\"><script>", "javascript:alert(1)", "//evil.example/x.png", "/media/"]) {
  const r = await g.req("PUT", "/api/v1/profile", profBody(bad));
  console.log("  photoUrl", JSON.stringify(bad), "->", r.status);
  if (r.status === 200) rec(`3x photoUrl accepted: ${bad}`, false, "should be rejected (not an uploaded object)");
}
await g.req("PUT", "/api/v1/profile", profBody(av.url));

// ---------- 4 ----------
const p1 = await upload(g, "listing", "image/png", png());
const p2 = await upload(g, "listing", "image/png", png());
let r = await g.req("POST", "/api/v1/listings", { ...baseListing(), photos: [] });
rec("4a no photos active 422 photos", r.status === 422 && !!r.json?.fields?.photos, `${r.status} ${JSON.stringify(r.json?.fields)}`);
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), harvestStart: "2026-12-10", harvestEnd: "2026-12-01" });
rec("4b harvestEnd<start 422", r.status === 422 && !!r.json?.fields?.harvestEnd, `${r.status} ${JSON.stringify(r.json?.fields)}`);
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), price: null });
rec("4c fixed w/o price 422", r.status === 422 && !!r.json?.fields?.price, `${r.status} ${JSON.stringify(r.json?.fields)}`);
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), photos: [p1.url, p2.url] });
rec("4d valid listing", r.status === 200 && !!r.json?.slug, `${r.status} ${r.text.slice(0, 160)}`);
const L = r.json;
const row = (await db.query(`select * from "Listing" where id=$1`, [L.id])).rows[0];
rec("4e certs copied", JSON.stringify([...row.certifications].sort()) === JSON.stringify(["buy_bc", "organic"]), JSON.stringify(row.certifications));
rec("4f lotCode", /^AH-FR-[A-Z0-9]+$/.test(row.lotCode), row.lotCode);

// ---------- 5 ----------
const search = async (qs) => (await anon.req("GET", `/api/v1/listings?${qs}`)).json;
let s = await search(`q=${UNIQ}`);
rec("5a API search", s?.items?.some((i) => i.id === L.id), `total=${s?.total}`);
const mk = await anon.req("GET", `/marketplace?q=${UNIQ}`);
rec("5b /marketplace?q HTML", mk.status === 200 && mk.text.includes(L.slug), `${mk.status}`);
const tot = async (qs) => (await search(qs)).total;
const c1 = await tot(`q=${UNIQ}&category=berries`), c2 = await tot(`q=${UNIQ}&category=dairy`);
rec("5c category filter", c1 === 1 && c2 === 0, `berries=${c1} dairy=${c2}`);
const r1 = await tot(`q=${UNIQ}&region=fraser-valley`), r2 = await tot(`q=${UNIQ}&region=${otherRegion?.slug}`);
rec("5d region filter", r1 === 1 && r2 === 0, `fv=${r1} other=${r2}`);
const k1 = await tot(`q=${UNIQ}&cert=organic`), k2 = await tot(`q=${UNIQ}&cert=haccp`), k3 = await tot(`q=${UNIQ}&cert=haccp,buy_bc`);
rec("5e cert filter", k1 === 1 && k2 === 0 && k3 === 1, `organic=${k1} haccp=${k2} haccp|buy_bc=${k3}`);
const allCat = await tot(""), berries = await tot("category=berries"), berDairy = await tot("category=berries,dairy"), dairy = await tot("category=dairy");
rec("5f global category counts additive", berDairy === berries + dairy && berries <= allCat, `all=${allCat} berries=${berries} dairy=${dairy} both=${berDairy}`);
const pa = await search("sort=price_asc");
const prices = pa.items.map((i) => i.price);
const nn = prices.filter((p) => p != null);
const sorted = nn.every((p, i) => i === 0 || nn[i - 1] <= p) && prices.indexOf(null) === -1 ? true : nn.every((p, i) => i === 0 || nn[i - 1] <= p) && prices.slice(prices.indexOf(null)).every((p) => p == null);
rec("5g sort=price_asc", sorted, prices.join(","));
const up = await search("season=upcoming");
const now = Date.now();
rec("5h season=upcoming", up.items.every((i) => i.harvestStart && new Date(i.harvestStart).getTime() > now) && up.items.some((i) => i.id === L.id) === (up.total <= 24 ? true : up.items.some((i) => i.id === L.id) || true), `total=${up.total}`);
const page2 = await search("page=-5");
console.log("  page=-5 status total", page2?.total, page2?.page);
const pageNaN = await anon.req("GET", "/api/v1/listings?page=abc");
rec("5i page=abc no 500", pageNaN.status !== 500, `${pageNaN.status} ${pageNaN.text.slice(0, 100)}`);
const sortBad = await anon.req("GET", "/api/v1/listings?category=notacat");
rec("5j invalid category no 500", sortBad.status !== 500, `${sortBad.status} ${sortBad.text.slice(0, 100)}`);

// ---------- 6 ----------
const det = await anon.req("GET", `/marketplace/${L.slug}`);
rec("6a detail 200 title+QR", det.status === 200 && det.text.includes(`Fresh ${UNIQ} blueberries`) && det.text.includes("Lot traceability") && det.text.includes(row.lotCode), `${det.status}`);
const tr = await anon.req("GET", `/trace/${row.lotCode}`);
rec("6b /trace/<lot> 200", tr.status === 200 && tr.text.includes(row.lotCode), `${tr.status}`);
const trLower = await anon.req("GET", `/trace/${row.lotCode.toLowerCase()}`);
rec("6c /trace lowercase lot", trLower.status === 200, `${trLower.status}`);

// ---------- 7 ----------
r = await g.req("PATCH", `/api/v1/listings/${L.id}`, { status: "paused" });
s = await search(`q=${UNIQ}`);
rec("7a paused hidden", r.status === 200 && !s.items.some((i) => i.id === L.id), `${r.status} total=${s.total}`);
r = await g.req("PATCH", `/api/v1/listings/${L.id}`, { status: "active" });
s = await search(`q=${UNIQ}`);
rec("7b active again visible", r.status === 200 && s.items.some((i) => i.id === L.id), `${r.status} total=${s.total}`);
// other grower can't patch
const g2 = new Agent();
const su2 = await g2.req("POST", "/api/v1/auth/signup", { role: "grower", orgName: `QA Farm B ${rnd}`, contactName: "QA B", email: `qa-grower-${rnd}b@example.test`, password: `Qa-${rnd}-Strong!Pass9`, acceptTerms: true });
const pt = await g2.req("PATCH", `/api/v1/listings/${L.id}`, { status: "paused" });
rec("7c other grower PATCH 403", pt.status === 403, `${su2.status} -> ${pt.status}`);
const dl2 = await g2.req("DELETE", `/api/v1/listings/${L.id}`);
rec("7d other grower DELETE 403", dl2.status === 403, `${dl2.status}`);
// grower without photo can still PATCH/DELETE own? (not tested). Pending-photo user PATCH full body on someone else's: covered.

// a separate listing for delete
const Ldel = (await g.req("POST", "/api/v1/listings", { ...baseListing(), title: `Delete me ${UNIQ}`, photos: [p1.url] })).json;
r = await g.req("DELETE", `/api/v1/listings/${Ldel.id}`);
const st = (await db.query(`select status from "Listing" where id=$1`, [Ldel.id])).rows[0]?.status;
s = await search(`q=Delete me ${UNIQ}`);
const dd = await anon.req("GET", `/marketplace/${Ldel.slug}`);
rec("7e DELETE archived/hidden/404", r.status === 200 && st === "archived" && !s.items.some((i) => i.id === Ldel.id) && dd.status === 404, `${r.status} status=${st} detail=${dd.status}`);
const trArch = await anon.req("GET", `/trace/${(await db.query(`select "lotCode" from "Listing" where id=$1`, [Ldel.id])).rows[0].lotCode}`);
console.log("  trace page for archived lot:", trArch.status);

// ---------- 8 ----------
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), title: `Draft ${UNIQ} plan`, status: "draft", photos: [] });
rec("8a draft no photos ok", r.status === 200, `${r.status} ${r.text.slice(0, 120)}`);
const Ldraft = r.json;
s = await search(`q=Draft ${UNIQ}`);
const dr = Ldraft ? await anon.req("GET", `/marketplace/${Ldraft.slug}`) : { status: 0 };
rec("8b draft hidden publicly", !s.items.length && dr.status === 404, `search=${s.total} detail=${dr.status}`);
const drOwner = Ldraft ? await g.req("GET", `/marketplace/${Ldraft.slug}`) : { status: 0 };
rec("8c owner can preview draft", drOwner.status === 200, `${drOwner.status}`);
const pubNoPhoto = await g.req("PATCH", `/api/v1/listings/${Ldraft.id}`, { status: "active" });
rec("8d draft->active w/o photo 422", pubNoPhoto.status === 422, `${pubNoPhoto.status}`);
const draftTrace = (await db.query(`select "lotCode" from "Listing" where id=$1`, [Ldraft.id])).rows[0].lotCode;
const dt = await anon.req("GET", `/trace/${draftTrace}`);
rec("8e draft lot trace hidden from anon", dt.status === 404, `trace=${dt.status}`);

// ---------- 9 ----------
const gid = (await db.query(`select id from "User" where email=$1`, [email])).rows[0].id;
const activeDb = Number((await db.query(`select count(*) from "Listing" where "growerId"=$1 and status='active'`, [gid])).rows[0].count);
const dash = await g.req("GET", "/dashboard");
const m = dash.text.replace(/<!-- -->/g, "").match(/Active listings<\/p>.{0,400}?>(\d+)</s) || dash.text.match(/Active listings[\s\S]{0,600}?>(\d+)</);
rec("9a Active listings count", m && Number(m[1]) === activeDb, `html=${m?.[1]} db=${activeDb}`);
rec("9b My listings rows", dash.text.includes("My listings") && dash.text.includes(L.title) && dash.text.includes(Ldraft.title ?? `Draft ${UNIQ} plan`), "");

// ---------- 10 ----------
const cf = await upload(g, "certificate", "application/pdf", PDF);
rec("10a cert upload", !!cf.url, cf.err ?? cf.url);
r = await g.req("POST", "/api/v1/profile/certs", { type: "organic", documentUrl: cf.url, expiresAt: "2027-12-31" });
rec("10b POST certs", r.status === 200 && r.json?.ok, `${r.status} ${r.text.slice(0, 100)}`);
const pp = await g.req("GET", "/dashboard/profile");
rec("10c on /dashboard/profile", pp.status === 200 && pp.text.includes(cf.url), `${pp.status}`);
const cfFake = await upload(g, "certificate", "application/pdf", Buffer.from("not a pdf at all, just text..."));
rec("10d fake PDF bytes rejected", !!cfFake.err && /415/.test(cfFake.err), cfFake.err ?? "accepted!");
const rcBad = await g.req("POST", "/api/v1/profile/certs", { type: "organic", documentUrl: "/media/../../.env", expiresAt: null });
console.log("  cert documentUrl traversal:", rcBad.status);
const rcOther = await g.req("POST", "/api/v1/profile/certs", { type: "organic", documentUrl: "/media/listing/x.pdf" });
console.log("  cert documentUrl not owned:", rcOther.status);
const mediaGet = await anon.req("GET", cf.url);
console.log("  anon GET cert doc media:", mediaGet.status);

// ---------- 11 ----------
const admin = new Agent();
const al = await admin.req("POST", "/api/v1/auth/login", { email: "admin@agrihub.test", password: PW, portal: "admin" });
console.log("  admin login", al.status, al.text.slice(0, 100));
r = await admin.req("POST", "/api/v1/listings", { ...baseListing(), title: `Assisted ${UNIQ} raspberries`, growerId: gid, photos: [p1.url] });
const ar = r.json ? (await db.query(`select approval, "growerId" from "Listing" where id=$1`, [r.json.id])).rows[0] : null;
const notif = Number((await db.query(`select count(*) from "Notification" where "userId"=$1 and title like 'GRIS Canada created%'`, [gid])).rows[0].count);
rec("11 admin assisted listing", r.status === 200 && ar?.approval === "approved" && ar?.growerId === gid && notif >= 1, `${r.status} ${JSON.stringify(ar)} notif=${notif} ${al.json?.needTotp ? "needTotp" : ""}`);
r = await admin.req("POST", "/api/v1/listings", { ...baseListing(), title: `Assisted bad`, growerId: (await db.query(`select id from "User" where email='buyer@agrihub.test'`)).rows[0]?.id });
rec("11b admin growerId=buyer 422", r.status === 422, `${r.status}`);

// ---------- 12 ----------
const buyer = new Agent();
const bl = await buyer.req("POST", "/api/v1/auth/login", { email: "buyer@agrihub.test", password: PW, portal: "member" });
const ALERT = `alrt${rnd}kale`;
const ss = await buyer.req("POST", "/api/v1/saved-searches", { name: `QA ${rnd}`, query: { q: ALERT } });
const bid = (await db.query(`select id from "User" where email='buyer@agrihub.test'`)).rows[0].id;
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), title: `Organic ${ALERT} bunches`, produce: "Kale", category: "vegetable", photos: [p2.url] });
const sm = Number((await db.query(`select count(*) from "Notification" where "userId"=$1 and type='search_match' and title like $2`, [bid, `%${ALERT}%`])).rows[0].count);
rec("12 saved-search alert", bl.status === 200 && ss.status === 200 && r.status === 200 && sm === 1, `login=${bl.status} ss=${ss.status} listing=${r.status} notifs=${sm}`);
// draft->active via PATCH should also trigger alert?
const ALERT2 = `alrt${rnd}leek`;
await buyer.req("POST", "/api/v1/saved-searches", { name: `QA2 ${rnd}`, query: { q: ALERT2 } });
const dft = (await g.req("POST", "/api/v1/listings", { ...baseListing(), title: `Draft ${ALERT2} crop`, status: "draft", photos: [p1.url] })).json;
await g.req("PATCH", `/api/v1/listings/${dft.id}`, { status: "active" });
const sm2 = Number((await db.query(`select count(*) from "Notification" where "userId"=$1 and type='search_match' and title like $2`, [bid, `%${ALERT2}%`])).rows[0].count);
rec("12b alert on draft->active publish", sm2 === 1, `notifs=${sm2}`);

// ---------- 13 ----------
const long = "A".repeat(121);
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), title: long, photos: [p1.url] });
rec("13a title >120 422", r.status === 422, `${r.status}`);
const emoji = `Bluebs 🫐 ${UNIQ} — Côte-d'Été 日本`;
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), title: emoji, photos: [p1.url] });
const er = r.json ? (await db.query(`select title, slug from "Listing" where id=$1`, [r.json.id])).rows[0] : null;
const emDet = r.json ? await anon.req("GET", `/marketplace/${r.json.slug}`) : { status: 0, text: "" };
rec("13b unicode/emoji title", r.status === 200 && er?.title === emoji && emDet.status === 200 && emDet.text.includes("🫐"), `${r.status} slug=${er?.slug} detail=${emDet.status}`);
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), volume: -5, photos: [p1.url] });
rec("13c negative volume 422", r.status === 422, `${r.status}`);
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), price: -1, photos: [p1.url] });
rec("13d negative price 422", r.status === 422, `${r.status}`);
const XSS = `<script>alert('x${rnd}')</script><img src=x onerror=alert(1)>`;
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), title: `XSS ${UNIQ} ${XSS}`.slice(0, 120), description: `desc ${XSS}`, photos: [p1.url] });
const xd = r.json ? await anon.req("GET", `/marketplace/${r.json.slug}`) : { text: "" };
const xm = await anon.req("GET", `/marketplace?q=XSS ${UNIQ}`);
rec("13e XSS escaped", r.status === 200 && !xd.text.includes(`<script>alert('x${rnd}')`) && !xd.text.includes("<img src=x onerror") && !xm.text.includes(`<script>alert('x${rnd}')`), `${r.status} detail=${xd.status}`);
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), title: "   ", photos: [p1.url] });
rec("13f whitespace title 422", r.status === 422, `${r.status}`);
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), photos: [p1.url], growerId: "someoneelse" });
const gr = r.json ? (await db.query(`select "growerId" from "Listing" where id=$1`, [r.json.id])).rows[0] : null;
rec("13g grower can't spoof growerId", !gr || gr.growerId === gid, JSON.stringify(gr));
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), photos: [p1.url], harvestStart: "not-a-date" });
rec("13h bad date 422", r.status === 422, `${r.status}`);
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), photos: [p1.url], regionId: "nonexistent-region" });
rec("13i bad regionId no 500", r.status !== 500, `${r.status} ${r.text.slice(0, 100)}`);
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), photos: ["/media/listing/2026/01/someoneelse-abc.png"] });
rec("13j photo not owned/nonexistent accepted?", r.status === 422, `${r.status} (zMedia only checks prefix)`);
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), photos: [p1.url], status: "archived" });
console.log("  create with status archived:", r.status);
r = await g.req("POST", "/api/v1/listings", { ...baseListing(), title: `Year ${UNIQ}`, photos: [p1.url], harvestStart: "99999-01-01" });
console.log("  harvestStart 99999:", r.status, r.text.slice(0, 80));
const bodyNull = await g.req("PATCH", `/api/v1/listings/${L.id}`, "null");
rec("13k PATCH body null no 500", bodyNull.status !== 500, `${bodyNull.status}`);
const badJson = await g.req("PATCH", `/api/v1/listings/${L.id}`, "{bad", { headers: { "content-type": "application/json" } });
rec("13l PATCH bad JSON 400", badJson.status === 400, `${badJson.status} ${badJson.text.slice(0, 80)}`);
const badStatus = await g.req("PATCH", `/api/v1/listings/${L.id}`, { status: "bogus" });
rec("13m PATCH bad status 422", badStatus.status === 422, `${badStatus.status} ${badStatus.text.slice(0, 80)}`);
// PATCH full update: may it bypass photo requirement via full body with status active and photos? covered by schema. Can a grower PATCH full body with growerId to transfer?
const fullPatch = await g.req("PATCH", `/api/v1/listings/${L.id}`, { ...baseListing(), photos: [p1.url], growerId: (await db.query(`select id from "User" where email='grower@agrihub.test'`)).rows[0].id });
const afterPatch = (await db.query(`select "growerId", certifications from "Listing" where id=$1`, [L.id])).rows[0];
rec("13n full PATCH keeps owner", afterPatch.growerId === gid, `${fullPatch.status} owner=${afterPatch.growerId === gid ? "same" : "CHANGED"}`);
// CSRF: cross-origin POST
const csrf = await g.req("POST", "/api/v1/listings", { ...baseListing(), photos: [p1.url] }, { headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" } });
rec("13o cross-origin POST blocked", csrf.status === 403, `${csrf.status}`);
// grower without photo: PATCH own? g2 has no photo; try create draft
const g2d = await g2.req("POST", "/api/v1/listings", { ...baseListing(), status: "draft", photos: [] });
rec("13p no-photo grower draft blocked 403", g2d.status === 403, `${g2d.status}`);
// buyer cannot create listing
const bc = await buyer.req("POST", "/api/v1/listings", { ...baseListing(), photos: [p1.url] });
rec("13q buyer create listing 403", bc.status === 403, `${bc.status}`);
// signup dup email
const dup = await new Agent().req("POST", "/api/v1/auth/signup", { role: "grower", orgName: "Dup", contactName: "Dup", email: email.toUpperCase(), password: `Qa-${rnd}-Strong!Pass9`, acceptTerms: true });
rec("13r duplicate email (case) 409", dup.status === 409, `${dup.status}`);
// signup as admin role
const adm = await new Agent().req("POST", "/api/v1/auth/signup", { role: "admin", orgName: "Hax", contactName: "Hax", email: `qa-grower-${rnd}x@example.test`, password: `Qa-${rnd}-Strong!Pass9`, acceptTerms: true });
rec("13s signup role=admin rejected", adm.status === 422, `${adm.status}`);
// upload with mismatched bytes (PNG declared, PDF sent)
const mis = await upload(g, "avatar", "image/png", PDF);
rec("13t avatar w/ PDF bytes rejected", !!mis.err, mis.err ?? "accepted");
const svg = await g.req("POST", "/api/v1/uploads/sign", { kind: "avatar", contentType: "image/svg+xml", size: 100 });
rec("13u SVG avatar 415", svg.status === 415, `${svg.status}`);

console.log("\nSUMMARY");
for (const x of results) console.log(`${x.ok ? "PASS" : "FAIL"}\t${x.id}\t${x.note}`);
console.log(JSON.stringify({ email, gid, listing: L, UNIQ }));
await db.end();
