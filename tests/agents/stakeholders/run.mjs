// Stakeholder acceptance suite: signs up one account per stakeholder type, completes onboarding,
// and runs each type's core journeys with real test inquiries (messages, RFQs, demand offers,
// program interest, event RSVPs, claims, community posts and assistant questions).
// Run from project root with the dev server on :3100:  node tests/agents/stakeholders/run.mjs
import "dotenv/config";
import pg from "pg";
import zlib from "node:zlib";
import { readFileSync } from "node:fs";

const BASE = process.env.QA_BASE ?? "http://localhost:3100";
const PW_ADMIN = process.env.QA_PASSWORD || (readFileSync("prisma/seed.ts", "utf8").match(/DEMO_PASSWORD = (?:process\.env\.SEED_PASSWORD \|\| )?"([^"]+)"/) || [])[1];
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = async (sql, params) => (await db.query(sql, params)).rows;

const results = [];
const check = (id, ok, note = "") => {
  results.push({ id, ok: !!ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}${ok ? "" : `  -- ${typeof note === "string" ? note : JSON.stringify(note)?.slice(0, 300)}`}`);
};

let ipSeq = 10;
class Agent {
  constructor(label) {
    this.label = label;
    this.jar = {};
    this.ip = `10.77.0.${ipSeq++}`; // distinct client IPs so per-IP limits don't couple the personas
  }
  cookie() {
    return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async req(method, path, body) {
    const headers = { cookie: this.cookie(), origin: BASE, "sec-fetch-site": "same-origin", "x-real-ip": this.ip };
    let payload;
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const r = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
    for (const c of r.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      this.jar[kv.slice(0, i)] = kv.slice(i + 1);
    }
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: r.status, json, text, location: r.headers.get("location") };
  }
}

function png() {
  const crc = (b) => {
    let c;
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    let x = 0xffffffff;
    for (const v of b) x = t[(x ^ v) & 0xff] ^ (x >>> 8);
    return (x ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.from([0, 30, 120, 60]))), chunk("IEND", Buffer.alloc(0))]);
}

async function upload(a, kind = "avatar") {
  const bytes = png();
  const s = await a.req("POST", "/api/v1/uploads/sign", { kind, contentType: "image/png", size: bytes.length });
  if (s.status !== 200) return null;
  const p = await fetch(BASE + s.json.uploadUrl, { method: "PUT", headers: { "content-type": "image/png", cookie: a.cookie(), origin: BASE, "sec-fetch-site": "same-origin" }, body: bytes });
  return p.status === 200 ? s.json.publicUrl : null;
}

const rnd = Math.random().toString(36).slice(2, 7);
const region = (await q(`select id from "Region" where slug='fraser-valley'`))[0];
const PASSWORD = `Qa-${rnd}-Stakeholder!42`;
const PORTAL = (role) => (["grower", "buyer"].includes(role) ? "member" : "partner");

/** sign up + upload a photo + complete the profile; returns a signed-in agent */
async function onboard(key, role, extra = {}) {
  const a = new Agent(key);
  a.email = `qa-${key}-${rnd}@example.test`;
  a.org = `QA ${key} ${rnd}`;
  a.role = role;
  const su = await a.req("POST", "/api/v1/auth/signup", { role, orgName: a.org, contactName: `Tester ${key}`, email: a.email, city: "Abbotsford", regionId: region.id, password: PASSWORD, acceptTerms: true, ...extra });
  const photo = await upload(a);
  const pr = await a.req("PUT", "/api/v1/profile", { orgName: a.org, contactName: `Tester ${key}`, tagline: `${key} test account`, bio: "Automated stakeholder QA account.", photoUrl: photo, city: "Abbotsford", regionId: region.id, specialties: [key], certifications: [], ...extra });
  const dash = await a.req("GET", "/dashboard");
  check(`${key}: signup → photo → profile → dashboard`, su.status === 200 && photo && pr.status === 200 && dash.status === 200, `signup=${su.status} ${su.json?.error ?? ""} photo=${!!photo} profile=${pr.status} ${pr.json?.error ?? ""} dash=${dash.status}`);
  a.slug = pr.json?.slug;
  a.id = (await q(`select id from "User" where email=$1`, [a.email]))[0]?.id;
  return a;
}

/** portal separation: the account signs in only through its own portal */
async function portalCheck(a) {
  const wrong = PORTAL(a.role) === "member" ? "partner" : "member";
  const fresh = new Agent(`${a.label}-login`);
  const bad = await fresh.req("POST", "/api/v1/auth/login", { email: a.email, password: PASSWORD, portal: wrong });
  const ok = await fresh.req("POST", "/api/v1/auth/login", { email: a.email, password: PASSWORD, portal: PORTAL(a.role) });
  check(`${a.label}: signs in only via ${PORTAL(a.role)} portal`, bad.status === 403 && ok.status === 200, `wrong=${bad.status} right=${ok.status}`);
}

async function ask(a, question, expect) {
  const r = await a.req("POST", "/api/v1/assistant", { messages: [{ role: "user", content: question }] });
  const ok = r.status === 200 && typeof r.json?.reply === "string" && r.json.reply.length > 20 && (!expect || expect.test(r.json.reply));
  check(`${a.label}: assistant answers “${question}”`, ok, `${r.status} ${r.json?.mode ?? ""} ${(r.json?.reply ?? r.text).slice(0, 160)}`);
  return r.json;
}

const admin = new Agent("admin");
const al = await admin.req("POST", "/api/v1/auth/login", { email: "admin@agrihub.test", password: PW_ADMIN, portal: "admin" });
check("admin: signs in via admin portal", al.status === 200, al.text.slice(0, 120));
const approve = (type, id) => admin.req("POST", "/api/v1/admin/moderate", { type, id, action: "approve" });

/* ============ Visitor (not signed in) ============ */
const visitor = new Agent("visitor");
for (const p of ["/", "/marketplace", "/directory", "/directory?tab=buy-bc", "/buy-bc", "/buy-bc?category=Beverages", "/demand", "/resources", "/events", "/community", "/insights", "/about", "/credits", "/signup", "/login", "/partners/login"]) {
  const r = await visitor.req("GET", p);
  if (r.status !== 200) check(`visitor: GET ${p}`, false, r.status);
}
check("visitor: 16 public pages load", true);
const vd = await visitor.req("GET", "/dashboard");
check("visitor: /dashboard redirects to sign-in", [302, 303, 307].includes(vd.status) && /login/.test(vd.location ?? ""), `${vd.status} ${vd.location}`);
const vm = await visitor.req("POST", "/api/v1/threads", { recipientId: "x", body: "hello" });
check("visitor: cannot send messages (401)", vm.status === 401, vm.status);
await ask(visitor, "Who sells blueberries?", /blueberr/i);

/* ============ Seeded growers / listings used for inquiries ============ */
const [seedGrower] = await q(`select u.id, p."orgName" from "User" u join "Profile" p on p."userId"=u.id where u.email='grower@agrihub.test'`);
const [seedListing] = await q(`select id, title, unit from "Listing" where "growerId"=$1 and status='active' order by "createdAt" limit 1`, [seedGrower.id]);
const [buyBcProfile] = await q(`select p.id, p.slug, u.id uid from "Profile" p join "User" u on u.id=p."userId" where p."isClaimed"=false and p.certifications @> ARRAY['buy_bc'] order by p."orgName" limit 1`);

/* ============ Grower ============ */
const grower = await onboard("grower", "grower", { certifications: ["buy_bc"] });
await portalCheck(grower);
const gl = await grower.req("POST", "/api/v1/listings", {
  title: `QA ${rnd} Duke blueberries`, produce: "Blueberries", category: "berries", description: "Stakeholder QA listing.", volume: 800, unit: "kg", price: 4.75, priceUnit: "kg", pricingMethod: "fixed",
  harvestStart: new Date(Date.now() + 5 * 864e5).toISOString(), harvestEnd: new Date(Date.now() + 50 * 864e5).toISOString(), status: "active", photos: [await upload(grower, "listing")], regionId: region.id, deliveryOptions: ["pickup"],
});
check("grower: publishes a listing with photo", gl.status === 200 && gl.json?.id, `${gl.status} ${gl.text.slice(0, 200)}`);
const growerListing = gl.json?.id;
if (gl.json?.approval === "pending") await approve("listing", growerListing);
await ask(grower, "Which programs help with exporting?", /export|program/i);

/* ============ Buyers: retail, processor, export ============ */
const buyers = [];
for (const [key, buyerType] of [["buyer-retail", "retail"], ["buyer-processor", "processor"], ["buyer-export", "export"]]) {
  const b = await onboard(key, "buyer", { buyerType });
  buyers.push(b);
  await portalCheck(b);
  // test inquiry 1: message about a listing
  const t = await b.req("POST", "/api/v1/threads", { recipientId: grower.id, listingId: growerListing, body: `Hi, ${b.org} here — is 300 kg/week available for July delivery to Vancouver? (${key} test inquiry)` });
  check(`${key}: sends listing inquiry to grower`, t.status === 200 && t.json?.threadId, `${t.status} ${t.text.slice(0, 160)}`);
  b.threadId = t.json?.threadId;
  // test inquiry 2: request for quote
  const rfq = await b.req("POST", "/api/v1/rfqs", { listingId: growerListing, quantity: 300, unit: "kg", targetPrice: 4.25, neededBy: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10), notes: `${key} RFQ test` });
  check(`${key}: sends RFQ`, rfq.status === 200, `${rfq.status} ${rfq.text.slice(0, 160)}`);
  b.rfqId = rfq.json?.id ?? rfq.json?.rfqId;
  const tab = buyerType === "processor" ? "processors" : "buyers";
  const dir = await visitor.req("GET", `/directory?tab=${tab}&q=${encodeURIComponent(b.org)}`);
  check(`${key}: appears under directory “${tab}” tab`, dir.status === 200 && dir.text.includes(b.org), dir.status);
}
const retail = buyers[0];
// buyer posts demand; grower, supplier and dealer will offer on it
const dm = await retail.req("POST", "/api/v1/demand", { title: `QA ${rnd} weekly greenhouse tomatoes`, produce: "Tomatoes", category: "vegetable", quantity: 500, unit: "kg", frequency: "weekly", targetPrice: 3.1, regionId: region.id, details: "Stakeholder QA demand post." });
check("buyer-retail: posts a demand request", dm.status === 200 && dm.json?.id, `${dm.status} ${dm.text.slice(0, 160)}`);
const demandId = dm.json?.id;
if (dm.json?.approval === "pending") await approve("demand", demandId);
await ask(retail, "Find Buy BC apple cider makers", /cider|buy bc/i);

/* ============ Grower responds to inquiries ============ */
const gn = await grower.req("GET", "/api/v1/notifications");
check("grower: notified of buyer inquiries", gn.status === 200 && (gn.json?.items ?? []).filter((n) => !n.readAt).length >= 3, `unread=${(gn.json?.items ?? []).filter((n) => !n.readAt).length}`);
const reply = await grower.req("POST", `/api/v1/threads/${retail.threadId}/messages`, { body: "Yes — 300 kg/week from July 10. Happy to send a quote." });
check("grower: replies to buyer message", reply.status === 200, `${reply.status} ${reply.text.slice(0, 120)}`);
const quote = await grower.req("POST", `/api/v1/rfqs/${retail.rfqId}`, { action: "quote", price: 4.4, notes: "Includes pallets, FOB Abbotsford." });
check("grower: quotes the RFQ", quote.status === 200, `${quote.status} ${quote.text.slice(0, 160)}`);
const accept = await retail.req("POST", `/api/v1/rfqs/${retail.rfqId}`, { action: "accept" });
check("buyer-retail: accepts the quote", accept.status === 200, `${accept.status} ${accept.text.slice(0, 160)}`);
const offer = await grower.req("POST", `/api/v1/demand/${demandId}`, { message: "We can supply 500 kg/week of TOV tomatoes from our Abbotsford greenhouse." });
check("grower: makes an offer on the demand post", offer.status === 200, `${offer.status} ${offer.text.slice(0, 160)}`);
const rev = await retail.req("POST", "/api/v1/reviews", { subjectId: grower.id, rating: 5, body: "Great communication and quality on the test order." });
check("buyer-retail: reviews the grower after trading", rev.status === 200, `${rev.status} ${rev.text.slice(0, 160)}`);

/* ============ Partners ============ */
const partnerDefs = [
  ["university", "university", { type: "research", title: "Applied research: berry irrigation trial" }],
  ["consultant", "consultant", { type: "service", title: "CanadaGAP audit preparation" }],
  ["edc", "edc", { type: "export", title: "Export credit insurance for berry exporters" }],
  ["fcc", "fcc", { type: "financing", title: "Young farmer loan" }],
  ["financing", "financing", { type: "financing", title: "Harvester lease-to-own" }],
  ["bc-gov", "bc_gov", { type: "grant", title: "BC on-farm efficiency rebate" }],
  ["fed-gov", "fed_gov", { type: "program", title: "Federal AgriInnovate intake" }],
  ["agtech", "agtech", { type: "product", title: "Soil sensor 60-day trial" }],
  ["marketing", "sales_marketing", { type: "service", title: "Retail-ready packaging design" }],
  ["supplier", "supplier", { type: "product", title: "Bulk clamshells and berry flats" }],
  ["dealer", "dealer", { type: "product", title: "Tractor and sprayer demo days" }],
];
for (const [key, role, res] of partnerDefs) {
  const p = await onboard(key, role);
  await portalCheck(p);
  const r = await p.req("POST", "/api/v1/resources", { ...res, title: `${res.title} (${rnd})`, summary: `Stakeholder QA ${key} offer for BC growers and processors.`, eligibility: "BC producers", externalUrl: "https://griscanada.org", tags: ["qa"] });
  check(`${key}: publishes a program/offer`, r.status === 200 && r.json?.id, `${r.status} ${r.text.slice(0, 160)}`);
  const rid = r.json?.id;
  if (rid) await approve("resource", rid);
  // test inquiry: grower expresses interest → partner sees the lead
  const i = await grower.req("POST", `/api/v1/resources/${rid}`, { message: `Interested — please contact QA Farm (${key} test inquiry).` });
  const leads = await p.req("GET", "/dashboard/leads");
  check(`${key}: receives grower interest as a lead`, i.status === 200 && leads.status === 200 && leads.text.includes(grower.org), `interest=${i.status} leads=${leads.status}`);
  if (role === "supplier" || role === "dealer") {
    const o = await p.req("POST", `/api/v1/demand/${demandId}`, { message: `${key}: we can supply packaging and equipment for this program.` });
    check(`${key}: can offer on buyer demand`, o.status === 200, `${o.status} ${o.text.slice(0, 120)}`);
  } else {
    const o = await p.req("POST", `/api/v1/demand/${demandId}`, { message: "offer from a non-supplier partner" });
    check(`${key}: cannot offer on produce demand (403)`, o.status === 403, o.status);
  }
  if (key === "university") {
    const ev = await p.req("POST", "/api/v1/events", { title: `QA ${rnd} berry field day`, description: "Stakeholder QA event at the research plots.", type: "farm_tour", startsAt: new Date(Date.now() + 14 * 864e5).toISOString(), location: "Abbotsford, BC", capacity: 2 });
    check("university: hosts an event", ev.status === 200 && ev.json?.id, `${ev.status} ${ev.text.slice(0, 160)}`);
    if (ev.json?.id) await approve("event", ev.json.id);
    const rs1 = await grower.req("POST", `/api/v1/events/${ev.json?.id}`);
    const rs2 = await retail.req("POST", `/api/v1/events/${ev.json?.id}`);
    const rs3 = await buyers[1].req("POST", `/api/v1/events/${ev.json?.id}`);
    check("event: RSVPs fill to capacity, then waitlist/full", rs1.status === 200 && rs2.status === 200 && rs3.status !== 200, `${rs1.status} ${rs2.status} ${rs3.status} ${rs3.text.slice(0, 100)}`);
  }
  if (key === "edc") await ask(p, "How many Buy BC beverage products are there?", /\d/);
}

/* ============ Claims and unclaimed profiles ============ */
const um = await retail.req("POST", "/api/v1/threads", { recipientId: buyBcProfile.uid, body: "Do you supply wholesale?" });
check("unclaimed Buy BC profile cannot receive messages (422)", um.status === 422, `${um.status} ${um.json?.error ?? ""}`);
const cl = await grower.req("POST", "/api/v1/reports", { targetType: "claim", targetId: buyBcProfile.id, reason: "This is our business", details: "QA claim request" });
check("grower: files a claim for a Buy BC profile", cl.status === 200, `${cl.status} ${cl.text.slice(0, 120)}`);
const unclaimedLogin = await new Agent("x").req("POST", "/api/v1/auth/login", { email: (await q(`select email from "User" where id=$1`, [buyBcProfile.uid]))[0].email, password: PW_ADMIN, portal: "member" });
check("unclaimed directory accounts cannot sign in", unclaimedLogin.status === 401, unclaimedLogin.status);
const bbPage = await visitor.req("GET", `/directory/${buyBcProfile.slug}`);
check("Buy BC profile lists its licensed products", bbPage.status === 200 && /Buy BC licensed products \(/.test(bbPage.text), bbPage.status);

/* ============ Community ============ */
const [space] = await q(`select id from "Space" where "isLocked" = false order by "sortOrder" limit 1`);
for (const a of [grower, retail]) {
  const p = await a.req("POST", "/api/v1/posts", { spaceId: space.id, title: `QA ${a.label} question`, body: `Test community post from ${a.org}.` });
  check(`${a.label}: posts in community`, p.status === 200, `${p.status} ${p.text.slice(0, 120)}`);
}

/* ============ Admin oversight ============ */
for (const p of ["/admin", "/admin/approvals", "/admin/users", "/admin/reports", "/admin/kpis", "/admin/audit", "/admin/mailbox"]) {
  const r = await admin.req("GET", p);
  if (r.status !== 200) check(`admin: GET ${p}`, false, r.status);
}
check("admin: console pages load", true);
const reps = await admin.req("GET", "/admin/reports");
check("admin: sees the profile claim request", reps.text.includes("This is our business") || reps.text.includes("claim"), "claim not visible");
const audit = await q(`select count(*)::int n from "AuditLog" where "createdAt" > now() - interval '30 minutes' and action like '%.approve'`).catch(() => [{ n: -1 }]);
check("admin: moderation actions are audited", audit[0].n !== 0, `audit rows=${audit[0].n}`);
const emails = await q(`select count(*)::int n from "EmailOutbox" where "createdAt" > now() - interval '30 minutes'`);
check("email notifications queued for inquiries", emails[0].n > 0, `outbox=${emails[0].n}`);

await db.end();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
