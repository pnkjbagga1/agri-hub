// Live marketplace test with brand-new dummy accounts: sign-up → email verification → profile with photo →
// listings → search → favourites → saved search → inquiry → RFQ → quote → accept/decline → review →
// demand board → partner programs → leads → pause/resume → permission checks. Everything is removed at the end.
// Usage: QA_BASE=https://… QA_PASSWORD=<live admin password> DATABASE_URL=… node tests/agents/live/dummy-accounts.mjs
import pg from "pg";
import zlib from "node:zlib";

const BASE = process.env.QA_BASE;
const ADMIN_PW = process.env.QA_PASSWORD;
if (!BASE || !ADMIN_PW || !process.env.DATABASE_URL) throw new Error("QA_BASE, QA_PASSWORD and DATABASE_URL are required");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = async (sql, params) => (await db.query(sql, params)).rows;
const rnd = Math.random().toString(36).slice(2, 7);
const TAG = `Demo ${rnd}`;
const EMAIL = (k) => `demo-${rnd}-${k}@example.test`;
const PASSWORD = `Demo-${rnd}-Farm!2027`;

const results = [];
const check = (id, ok, note = "") => {
  results.push({ id, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}${ok ? "" : `  -- ${String(typeof note === "string" ? note : JSON.stringify(note)).slice(0, 300)}`}`);
};

class Agent {
  constructor(label) {
    this.label = label;
    this.jar = {};
  }
  cookie() {
    return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async req(method, path, body) {
    const headers = { cookie: this.cookie(), origin: BASE, "sec-fetch-site": "same-origin" };
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
    return { status: r.status, json, text };
  }
}

/** A tiny valid PNG in a given colour, so each photo is a real image upload. */
function png(rgb = [30, 120, 60]) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  const crc = (b) => {
    let x = 0xffffffff;
    for (const v of b) x = table[(x ^ v) & 0xff] ^ (x >>> 8);
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
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.from([0, ...rgb]))), chunk("IEND", Buffer.alloc(0))]);
}
async function upload(a, kind, rgb) {
  const bytes = png(rgb);
  const s = await a.req("POST", "/api/v1/uploads/sign", { kind, contentType: "image/png", size: bytes.length });
  if (s.status !== 200) return null;
  const p = await fetch(BASE + s.json.uploadUrl, { method: "PUT", headers: { "content-type": "image/png", cookie: a.cookie(), origin: BASE, "sec-fetch-site": "same-origin" }, body: bytes });
  return p.status === 200 ? s.json.publicUrl : null;
}

const [fv] = await q(`select id from "Region" where slug='fraser-valley'`);
const accounts = {};

/** Sign up, verify the email via the link in the welcome email, add a photo and complete the profile. */
async function createAccount(key, role, org, contact, extra = {}) {
  const a = new Agent(key);
  a.email = EMAIL(key);
  a.org = `${org} (${TAG})`;
  a.role = role;
  const su = await a.req("POST", "/api/v1/auth/signup", { role, orgName: a.org, contactName: contact, email: a.email, city: "Abbotsford", regionId: fv.id, password: PASSWORD, acceptTerms: true, ...extra });
  check(`${key}: signs up as ${role}`, su.status === 200, `${su.status} ${su.json?.error ?? ""}`);
  const [mail] = await q(`select html, text from "EmailOutbox" where "to"=$1 order by "createdAt" desc limit 1`, [a.email]);
  const token = (mail?.html + mail?.text).match(/verify-email\?token=([A-Za-z0-9_-]+)/)?.[1];
  const v = token ? await a.req("POST", "/api/v1/auth/verify-email", { token }) : { status: 0 };
  const [u] = await q(`select id, "emailVerifiedAt" from "User" where email=$1`, [a.email]);
  check(`${key}: verifies the email with the link from the welcome email`, !!token && v.status === 200 && !!u?.emailVerifiedAt, `token=${!!token} verify=${v.status}`);
  a.id = u?.id;
  const photo = await upload(a, "avatar", [40, 110, 70]);
  const pr = await a.req("PUT", "/api/v1/profile", { orgName: a.org, contactName: contact, tagline: `${org}: demo account`, bio: `Demo account created to test the marketplace (${TAG}). Removed automatically.`, photoUrl: photo, city: "Abbotsford", regionId: fv.id, specialties: [key], certifications: [], ...extra });
  check(`${key}: uploads a profile photo and completes the profile`, !!photo && pr.status === 200, `photo=${!!photo} profile=${pr.status} ${pr.json?.error ?? ""}`);
  a.slug = pr.json?.slug;
  const d = await a.req("GET", "/dashboard");
  check(`${key}: dashboard opens with the "Protect your account" prompt`, d.status === 200 && d.text.includes("Protect your account"), d.status);
  accounts[key] = a;
  return a;
}

const admin = new Agent("admin");
let ok = false;
try {
  const al = await admin.req("POST", "/api/v1/auth/login", { email: "admin@agrihub.test", password: ADMIN_PW, portal: "admin" });
  check("admin: signs in to moderate", al.status === 200, al.status);
  const approve = (type, id) => admin.req("POST", "/api/v1/admin/moderate", { type, id, action: "approve" });

  /* ---------- 1. six dummy accounts ---------- */
  const berry = await createAccount("berry", "grower", "Hilltop Berry Farm", "Demo Grower One", { certifications: ["buy_bc"] });
  const veg = await createAccount("veg", "grower", "Riverbend Vegetables", "Demo Grower Two");
  const retail = await createAccount("retail", "buyer", "Valley Fresh Market", "Demo Buyer One", { buyerType: "retail" });
  const proc = await createAccount("processor", "buyer", "Coastal Fruit Processors", "Demo Buyer Two", { buyerType: "processor" });
  const supplier = await createAccount("supplier", "supplier", "Pack & Grow Supply", "Demo Supplier");
  const lender = await createAccount("lender", "financing", "Harvest Credit Co-op", "Demo Lender");

  /* ---------- 2. growers list produce with photos ---------- */
  const mk = async (g, title, produce, category, price, volume, rgb) => {
    const photo = await upload(g, "listing", rgb);
    const r = await g.req("POST", "/api/v1/listings", {
      title: `${title} (${TAG})`, produce, category, description: `Demo listing for marketplace testing (${TAG}).`, volume, unit: "kg", price, priceUnit: "kg", pricingMethod: "fixed",
      harvestStart: new Date(Date.now() + 7 * 864e5).toISOString(), harvestEnd: new Date(Date.now() + 60 * 864e5).toISOString(), status: "active", photos: [photo], regionId: fv.id, deliveryOptions: ["pickup", "delivery"],
    });
    check(`${g.label}: lists ${produce} with a photo`, r.status === 200 && r.json?.id && photo, `${r.status} ${r.text.slice(0, 160)}`);
    if (r.json?.approval === "pending") await approve("listing", r.json.id);
    return r.json?.id;
  };
  const blue = await mk(berry, "Duke blueberries", "Blueberries", "berries", 4.4, 2000, [60, 70, 160]);
  const rasp = await mk(berry, "Tulameen raspberries", "Raspberries", "berries", 7.5, 600, [190, 40, 70]);
  const kale = await mk(veg, "Lacinato kale", "Kale", "vegetable", 3.2, 900, [40, 120, 50]);

  /* ---------- 3. buyers discover the listings ---------- */
  const visitor = new Agent("visitor");
  const search = await visitor.req("GET", `/api/v1/listings?q=${encodeURIComponent(TAG)}`);
  check("public: all 3 new listings appear in marketplace search", search.json?.total === 3, search.json?.total);
  const berries = await visitor.req("GET", `/api/v1/listings?q=${encodeURIComponent(TAG)}&category=berries`);
  check("public: berries filter shows only the 2 berry listings", berries.json?.total === 2 && berries.json.items.every((i) => i.category === "berries"), berries.json?.total);
  const card = search.json?.items?.find((i) => i.title.startsWith("Duke"));
  const page = card ? await visitor.req("GET", card.url) : { status: 0, text: "" };
  check("public: the blueberry listing page shows the grower's farm", page.status === 200 && page.text.includes("Hilltop Berry Farm"), page.status);
  const dir = await visitor.req("GET", `/directory?tab=growers&q=${encodeURIComponent("Hilltop Berry Farm")}`);
  check("public: the new berry farm appears in the growers directory", dir.status === 200 && dir.text.includes("Hilltop Berry Farm"), dir.status);
  const prof = berry.slug ? await visitor.req("GET", `/directory/${berry.slug}`) : { status: 0, text: "" };
  check("public: the farm's profile page lists its produce", prof.status === 200 && prof.text.includes("Duke blueberries"), prof.status);

  const ss = await retail.req("POST", "/api/v1/saved-searches", { name: `Blueberries ${TAG}`, query: { q: "blueberr", category: ["berries"] }, alert: true });
  check("retail buyer: saves a search with alerts", ss.status === 200, `${ss.status} ${ss.text.slice(0, 120)}`);
  const fav = await retail.req("POST", `/api/v1/favorites/${blue}`);
  const saved = await retail.req("GET", "/dashboard/saved");
  check("retail buyer: favourites the blueberry listing", fav.status === 200 && saved.text.includes("Duke blueberries"), [fav.status, saved.status]);

  /* ---------- 4. inquiry → RFQ → quote → accept → review ---------- */
  const t = await retail.req("POST", "/api/v1/threads", { recipientId: berry.id, listingId: blue, body: `Hi from Valley Fresh Market. Could you supply 400 kg/week of blueberries for our 6 stores? (${TAG})` });
  check("retail buyer: messages the berry farm about the listing", t.status === 200 && t.json?.threadId, t.status);
  const rfq = await retail.req("POST", "/api/v1/rfqs", { listingId: rasp, quantity: 300, unit: "kg", targetPrice: 7, neededBy: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10), notes: `Weekly raspberries for retail (${TAG})` });
  check("retail buyer: sends a request for quote on raspberries", rfq.status === 200, `${rfq.status} ${rfq.text.slice(0, 120)}`);
  const rfqId = rfq.json?.id ?? rfq.json?.rfqId;
  const notes = await berry.req("GET", "/api/v1/notifications");
  check("berry farm: is notified of the message and the RFQ", (notes.json?.items ?? []).filter((n) => !n.readAt).length >= 2, (notes.json?.items ?? []).length);
  const inbox = await berry.req("GET", "/messages");
  check("berry farm: sees Valley Fresh Market in the inbox", inbox.status === 200 && inbox.text.includes("Valley Fresh Market"), inbox.status);
  const rep = await berry.req("POST", `/api/v1/threads/${t.json?.threadId}/messages`, { body: "Yes, 400 kg/week works from mid-July. Delivery to Vancouver is included." });
  check("berry farm: replies to the buyer", rep.status === 200, rep.status);
  const snoop = await veg.req("GET", `/messages/${t.json?.threadId}`);
  check("another grower cannot read that private conversation", snoop.status === 404 || snoop.status === 403 || (snoop.status === 200 && !snoop.text.includes("400 kg/week")), snoop.status);
  const quoteByOther = await proc.req("POST", `/api/v1/rfqs/${rfqId}`, { action: "quote", price: 1 });
  check("a different buyer cannot touch someone else's RFQ", quoteByOther.status !== 200, quoteByOther.status);
  const qt = await berry.req("POST", `/api/v1/rfqs/${rfqId}`, { action: "quote", price: 7.2, notes: "Includes flats and cold-chain delivery." });
  check("berry farm: quotes $7.20/kg", qt.status === 200, `${qt.status} ${qt.text.slice(0, 120)}`);
  const acc = await retail.req("POST", `/api/v1/rfqs/${rfqId}`, { action: "accept" });
  check("retail buyer: accepts the quote", acc.status === 200, acc.status);
  const [rfqRow] = await q(`select status from "Rfq" where id=$1`, [rfqId]);
  check("RFQ is recorded as accepted", rfqRow?.status === "accepted", rfqRow?.status);
  const rv = await retail.req("POST", "/api/v1/reviews", { subjectId: berry.id, rating: 5, body: "Excellent berries and on-time delivery." });
  check("retail buyer: leaves a 5-star review", rv.status === 200, `${rv.status} ${rv.text.slice(0, 120)}`);
  const prof2 = await visitor.req("GET", `/directory/${berry.slug}`);
  check("public: the review shows on the farm's profile", prof2.text.includes("Excellent berries"), prof2.status);

  /* ---------- 5. second buyer: RFQ → quote → buyer withdraws; and a grower declines a request ---------- */
  const rfq2 = await proc.req("POST", "/api/v1/rfqs", { listingId: kale, quantity: 800, unit: "kg", targetPrice: 2.5, neededBy: new Date(Date.now() + 25 * 864e5).toISOString().slice(0, 10), notes: `Kale for processing (${TAG})` });
  const rfq2Id = rfq2.json?.id ?? rfq2.json?.rfqId;
  const qt2 = await veg.req("POST", `/api/v1/rfqs/${rfq2Id}`, { action: "quote", price: 3.0 });
  const notMine = await proc.req("POST", `/api/v1/rfqs/${rfq2Id}`, { action: "decline" });
  const wd = await proc.req("POST", `/api/v1/rfqs/${rfq2Id}`, { action: "withdraw" });
  const [r2] = await q(`select status from "Rfq" where id=$1`, [rfq2Id]);
  check("processor: requests a kale quote, the veg farm quotes, the processor withdraws (only growers can decline)", rfq2.status === 200 && qt2.status === 200 && notMine.status === 403 && wd.status === 200 && r2?.status === "withdrawn", [rfq2.status, qt2.status, notMine.status, wd.status, r2?.status]);
  const rfq3 = await proc.req("POST", "/api/v1/rfqs", { listingId: blue, quantity: 5000, unit: "kg", targetPrice: 1.5, neededBy: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10), notes: `Large lowball order (${TAG})` });
  const rfq3Id = rfq3.json?.id ?? rfq3.json?.rfqId;
  const dec = await berry.req("POST", `/api/v1/rfqs/${rfq3Id}`, { action: "decline", notes: "Volume and price don't work this season." });
  const [r3] = await q(`select status from "Rfq" where id=$1`, [rfq3Id]);
  check("berry farm: declines a request it can't fill", rfq3.status === 200 && dec.status === 200 && r3?.status === "declined", [rfq3.status, dec.status, r3?.status]);

  /* ---------- 6. demand board ---------- */
  const dm = await retail.req("POST", "/api/v1/demand", { title: `Weekly greenhouse cucumbers (${TAG})`, produce: "Cucumbers", category: "vegetable", quantity: 700, unit: "kg", frequency: "weekly", targetPrice: 2.2, regionId: fv.id, details: "Demo demand post, removed automatically." });
  check("retail buyer: posts a demand request", dm.status === 200 && dm.json?.id, `${dm.status} ${dm.text.slice(0, 120)}`);
  if (dm.json?.approval === "pending") await approve("demand", dm.json.id);
  const board = await visitor.req("GET", "/demand");
  check("public: the request shows on the demand board", board.text.includes(`Weekly greenhouse cucumbers (${TAG})`), board.status);
  const o1 = await veg.req("POST", `/api/v1/demand/${dm.json?.id}`, { message: "We can supply 700 kg/week of greenhouse cucumbers from August." });
  const o2 = await supplier.req("POST", `/api/v1/demand/${dm.json?.id}`, { message: "We can supply the packaging for this program." });
  const o3 = await lender.req("POST", `/api/v1/demand/${dm.json?.id}`, { message: "offer from a lender" });
  check("veg farm and supplier can offer on the demand; the lender cannot", o1.status === 200 && o2.status === 200 && o3.status === 403, [o1.status, o2.status, o3.status]);
  const close = await retail.req("PATCH", `/api/v1/demand/${dm.json?.id}`, { isOpen: false });
  const late = await berry.req("POST", `/api/v1/demand/${dm.json?.id}`, { message: "late offer" });
  check("retail buyer: closes the request and later offers are refused", close.status === 200 && late.status === 404, [close.status, late.status]);

  /* ---------- 7. partner program → grower interest → lead ---------- */
  const res = await lender.req("POST", "/api/v1/resources", { type: "financing", title: `Harvest-season operating loan (${TAG})`, summary: "Demo financing offer for BC growers.", eligibility: "BC producers", externalUrl: "https://griscanada.org", tags: ["demo"] });
  check("lender: publishes a financing program", res.status === 200 && res.json?.id, `${res.status} ${res.text.slice(0, 120)}`);
  if (res.json?.id) await approve("resource", res.json.id);
  const interest = await berry.req("POST", `/api/v1/resources/${res.json?.id}`, { message: "Interested in a harvest loan for extra pickers." });
  const leads = await lender.req("GET", "/dashboard/leads");
  check("berry farm: shows interest, and it reaches the lender as a lead", interest.status === 200 && leads.text.includes("Hilltop Berry Farm"), [interest.status, leads.status]);
  const supRes = await supplier.req("POST", "/api/v1/resources", { type: "product", title: `Bulk clamshells and berry flats (${TAG})`, summary: "Demo supplier offer.", eligibility: "BC growers", externalUrl: "https://griscanada.org", tags: ["demo"] });
  check("supplier: publishes a product offer", supRes.status === 200, supRes.status);
  if (supRes.json?.id) await approve("resource", supRes.json.id);

  /* ---------- 8. listing controls ---------- */
  const pause = await veg.req("PATCH", `/api/v1/listings/${kale}`, { status: "paused" });
  const hidden = await visitor.req("GET", `/api/v1/listings?q=${encodeURIComponent(TAG)}`);
  const resume = await veg.req("PATCH", `/api/v1/listings/${kale}`, { status: "active" });
  const back = await visitor.req("GET", `/api/v1/listings?q=${encodeURIComponent(TAG)}`);
  check("veg farm: pausing hides the listing, resuming brings it back", pause.status === 200 && hidden.json?.total === 2 && resume.status === 200 && back.json?.total === 3, [pause.status, hidden.json?.total, resume.status, back.json?.total]);
  const steal = await berry.req("DELETE", `/api/v1/listings/${kale}`);
  check("one grower cannot delete another grower's listing", steal.status === 403 || steal.status === 404, steal.status);
  const buyerList = await retail.req("POST", "/api/v1/listings", { title: "x" });
  check("buyers cannot create produce listings", buyerList.status === 403, buyerList.status);

  /* ---------- 9. sign-in for every new account ---------- */
  for (const a of Object.values(accounts)) {
    const fresh = new Agent(`${a.label}-login`);
    const portal = ["grower", "buyer"].includes(a.role) ? "member" : "partner";
    const r = await fresh.req("POST", "/api/v1/auth/login", { email: a.email, password: PASSWORD, portal });
    check(`${a.label}: signs back in through the ${portal} portal`, r.status === 200, r.status);
  }
  ok = true;
} finally {
  /* ---------- clean-up: remove every demo account and everything it created ---------- */
  const users = await q(`select id from "User" where email like $1`, [`demo-${rnd}-%@example.test`]);
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await q(`delete from "Thread" t where exists (select 1 from "ThreadParticipant" p where p."threadId"=t.id and p."userId"=any($1))`, [ids]);
    await q(`delete from "Report" where "reporterId"=any($1)`, [ids]).catch(() => {});
    await q(`delete from "User" where id=any($1)`, [ids]);
  }
  await q(`delete from "EmailOutbox" where "to" like $1`, [`demo-${rnd}-%@example.test`]);
  const left = await q(
    `select (select count(*) from "User" where email like $1)::int users, (select count(*) from "Listing" where title like $2)::int listings, (select count(*) from "DemandPost" where title like $2)::int demand, (select count(*) from "Resource" where title like $2)::int programs`,
    [`demo-${rnd}-%@example.test`, `%(${TAG})%`],
  );
  console.log(`\ncleanup: leftover demo users=${left[0].users} listings=${left[0].listings} demand=${left[0].demand} programs=${left[0].programs}`);
  await db.end();
  const pass = results.filter((r) => r.ok).length;
  console.log(`\nDUMMY-ACCOUNT MARKETPLACE TEST: ${pass}/${results.length} passed${ok ? "" : " (stopped early)"}`);
}
