// Live smoke test: runs real test inquiries against a deployed AGRI HUB using the seeded demo
// accounts (no signups, so it stays inside production rate limits), then deletes everything it created.
// Usage (from project root):
//   QA_BASE=https://agri-hub-ten.vercel.app QA_PASSWORD=... DATABASE_URL=... node tests/agents/live/run.mjs
import pg from "pg";

const BASE = process.env.QA_BASE;
const PW = process.env.QA_PASSWORD;
if (!BASE || !PW || !process.env.DATABASE_URL) throw new Error("QA_BASE, QA_PASSWORD and DATABASE_URL are required");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = async (sql, params) => (await db.query(sql, params)).rows;
const START = new Date();
const rnd = Math.random().toString(36).slice(2, 7);

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
  async req(method, path, body, extraHeaders = {}) {
    const headers = { cookie: Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; "), origin: BASE, "sec-fetch-site": "same-origin", ...extraHeaders };
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
    return { status: r.status, json, text, headers: r.headers, location: r.headers.get("location") };
  }
  async login(email, portal) {
    const r = await this.req("POST", "/api/v1/auth/login", { email, password: PW, portal });
    check(`${this.label}: signs in to the ${portal} portal`, r.status === 200, `${r.status} ${r.text.slice(0, 120)}`);
    return r;
  }
}

const created = { threads: [], demand: [], reports: [] };
try {
  /* ---------- Public site ---------- */
  const visitor = new Agent("visitor");
  for (const [p, must] of [
    ["/", "AGRI HUB"], ["/marketplace", "listing"], ["/directory", "Directory"], ["/directory?tab=buy-bc", "Buy BC"],
    ["/buy-bc", "10,413"], ["/buy-bc?q=cider", "cider"], ["/demand", "Demand"], ["/resources", "program"], ["/events", "Event"],
    ["/community", "Community"], ["/insights", "Insight"], ["/about", "GRIS"], ["/credits", "Wikimedia"], ["/signup", "Grower"],
    ["/login", "Sign in"], ["/partners/login", "Partner"], ["/sitemap.xml", "<urlset"], ["/robots.txt", "Sitemap"],
  ]) {
    const r = await visitor.req("GET", p);
    check(`page ${p} loads`, r.status === 200 && r.text.toLowerCase().includes(must.toLowerCase()), `${r.status} missing "${must}"`);
  }
  const home = await visitor.req("GET", "/");
  const h = home.headers;
  check("security headers (CSP, HSTS, nosniff, frame-ancestors)", h.get("content-security-policy") && h.get("strict-transport-security") && h.get("x-content-type-options") === "nosniff" && /frame-ancestors/.test(h.get("content-security-policy") ?? ""), [...h.keys()].join(","));
  const photo = await visitor.req("GET", "/seed/photos/cover-1.jpg");
  check("real photos are served", photo.status === 200 && /image\/jpeg/.test(photo.headers.get("content-type") ?? ""), photo.status);
  const vd = await visitor.req("GET", "/dashboard");
  check("visitor: /dashboard redirects to sign-in", [302, 303, 307].includes(vd.status) && /login/.test(vd.location ?? ""), `${vd.status} ${vd.location}`);
  const vm = await visitor.req("POST", "/api/v1/threads", { recipientId: "x", body: "hello" });
  check("visitor: cannot send messages (401)", vm.status === 401, vm.status);
  const csrf = await new Agent("x").req("POST", "/api/v1/auth/login", { email: "grower@agrihub.test", password: PW, portal: "member" }, { origin: "https://evil.example", "sec-fetch-site": "cross-site" });
  check("cross-site login POST is rejected (CSRF)", csrf.status === 403, csrf.status);
  const badpw = await new Agent("x").req("POST", "/api/v1/auth/login", { email: "grower@agrihub.test", password: "wrong-password-123", portal: "member" });
  check("wrong password is rejected (401)", badpw.status === 401, badpw.status);
  for (const [question, re] of [["Who sells blueberries?", /blueberr/i], ["Find Buy BC apple cider makers", /cider/i], ["Are there export or grant programs?", /program|grant|export|EDC/i], ["How do I join as a grower?", /sign ?up|join|grower/i]]) {
    const r = await visitor.req("POST", "/api/v1/assistant", { messages: [{ role: "user", content: question }] });
    check(`assistant answers “${question}”`, r.status === 200 && re.test(r.json?.reply ?? ""), `${r.status} ${(r.json?.reply ?? r.text).slice(0, 140)}`);
  }

  /* ---------- Portal separation ---------- */
  const wrongPortal = await new Agent("x").req("POST", "/api/v1/auth/login", { email: "grower@agrihub.test", password: PW, portal: "partner" });
  check("grower cannot use the partner portal", wrongPortal.status !== 200, wrongPortal.status);
  const notAdmin = await new Agent("x").req("POST", "/api/v1/auth/login", { email: "buyer@agrihub.test", password: PW, portal: "admin" });
  check("buyer cannot use the admin portal", notAdmin.status !== 200, notAdmin.status);

  /* ---------- Sign in as each seeded stakeholder ---------- */
  const grower = new Agent("grower");
  const buyer = new Agent("buyer");
  const partner = new Agent("partner");
  const admin = new Agent("admin");
  await grower.login("grower@agrihub.test", "member");
  await buyer.login("buyer@agrihub.test", "member");
  await partner.login("partner@agrihub.test", "partner");
  await admin.login("admin@agrihub.test", "admin");
  for (const [a, p] of [[grower, "/dashboard"], [buyer, "/dashboard"], [partner, "/dashboard"], [admin, "/admin"]]) {
    const r = await a.req("GET", p);
    check(`${a.label}: ${p} opens`, r.status === 200, r.status);
  }
  const ba = await buyer.req("GET", "/admin");
  check("buyer: /admin is blocked", ba.status !== 200, ba.status);

  const [g] = await q(`select u.id from "User" u where u.email='grower@agrihub.test'`);
  const [b] = await q(`select u.id from "User" u where u.email='buyer@agrihub.test'`);
  const [listing, rfqListing] = await q(`select id, title from "Listing" where "growerId"=$1 and status='active' order by "createdAt" limit 2`, [g.id]);

  /* ---------- Buyer → grower test inquiries ---------- */
  const t = await buyer.req("POST", "/api/v1/threads", { recipientId: g.id, listingId: listing.id, body: `[Live QA ${rnd}] Hi, is 300 kg/week of “${listing.title}” available for July delivery to Vancouver?` });
  check("buyer: sends a listing inquiry to the grower", t.status === 200 && t.json?.threadId, `${t.status} ${t.text.slice(0, 160)}`);
  if (t.json?.threadId) created.threads.push(t.json.threadId);
  // a listing message opens an inquiry on that listing, so the RFQ goes on a second listing
  const rfq = await buyer.req("POST", "/api/v1/rfqs", { listingId: rfqListing.id, quantity: 300, unit: "kg", targetPrice: 4.25, neededBy: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10), notes: `[Live QA ${rnd}] RFQ test` });
  check("buyer: sends a request for quote", rfq.status === 200, `${rfq.status} ${rfq.text.slice(0, 160)}`);
  const rfqId = rfq.json?.id ?? rfq.json?.rfqId;
  if (rfqId) created.threads.push(...(await q(`select "threadId" from "Rfq" where id=$1`, [rfqId])).map((r) => r.threadId));

  const gn = await grower.req("GET", "/api/v1/notifications");
  check("grower: is notified of the inquiries", gn.status === 200 && (gn.json?.items ?? []).some((n) => new Date(n.createdAt) >= START), `items=${(gn.json?.items ?? []).length}`);
  const reply = await grower.req("POST", `/api/v1/threads/${t.json?.threadId}/messages`, { body: "Yes — 300 kg/week from July 10. Sending a quote now." });
  check("grower: replies to the buyer", reply.status === 200, `${reply.status} ${reply.text.slice(0, 120)}`);
  const quote = await grower.req("POST", `/api/v1/rfqs/${rfqId}`, { action: "quote", price: 4.4, notes: "Includes pallets, FOB Abbotsford." });
  check("grower: quotes the RFQ", quote.status === 200, `${quote.status} ${quote.text.slice(0, 160)}`);
  const accept = await buyer.req("POST", `/api/v1/rfqs/${rfqId}`, { action: "accept" });
  check("buyer: accepts the quote", accept.status === 200, `${accept.status} ${accept.text.slice(0, 160)}`);
  const inbox = await buyer.req("GET", `/messages/${t.json?.threadId}`);
  check("buyer: sees the grower's reply in messages", inbox.status === 200 && inbox.text.includes("300 kg/week from July 10"), inbox.status);

  /* ---------- Demand board ---------- */
  const [region] = await q(`select id from "Region" where slug='fraser-valley'`);
  const dm = await buyer.req("POST", "/api/v1/demand", { title: `[Live QA ${rnd}] weekly greenhouse tomatoes`, produce: "Tomatoes", category: "vegetable", quantity: 500, unit: "kg", frequency: "weekly", targetPrice: 3.1, regionId: region.id, details: "Live QA demand post — will be removed automatically." });
  check("buyer: posts a demand request", dm.status === 200 && dm.json?.id, `${dm.status} ${dm.text.slice(0, 160)}`);
  if (dm.json?.id) created.demand.push(dm.json.id);
  if (dm.json?.approval === "pending") {
    const ap = await admin.req("POST", "/api/v1/admin/moderate", { type: "demand", id: dm.json.id, action: "approve" });
    check("admin: approves the demand post", ap.status === 200, ap.status);
  }
  const offer = await grower.req("POST", `/api/v1/demand/${dm.json?.id}`, { message: "[Live QA] We can supply 500 kg/week of TOV tomatoes." });
  check("grower: makes an offer on the demand post", offer.status === 200, `${offer.status} ${offer.text.slice(0, 160)}`);
  if (offer.json?.threadId) created.threads.push(offer.json.threadId);
  const pOffer = await partner.req("POST", `/api/v1/demand/${dm.json?.id}`, { message: "offer from a consultant" });
  check("consultant partner cannot offer on produce demand (403)", pOffer.status === 403, pOffer.status);

  /* ---------- Partner programs ---------- */
  // a program from a signed-up (claimed) partner that this grower hasn't already shown interest in
  const [res] = await q(`select r.id, u.email from "Resource" r join "Profile" p on p.id=r."profileId" join "User" u on u.id=p."userId" where r.approval='approved' and p."isClaimed" and not exists (select 1 from "ResourceInterest" i where i."resourceId"=r.id and i."userId"=$1) limit 1`, [g.id]);
  if (res) {
    const owner = new Agent("program owner");
    await owner.login(res.email, "partner");
    const i = await grower.req("POST", `/api/v1/resources/${res.id}`, { message: `[Live QA ${rnd}] Interested — please contact us.` });
    const leads = await owner.req("GET", "/dashboard/leads");
    check("grower interest in a program reaches the partner as a lead", i.status === 200 && leads.status === 200 && leads.text.includes("Sumas Prairie Berry"), `interest=${i.status} leads=${leads.status}`);
    created.resourceInterest = { resourceId: res.id, userId: g.id };
  } else check("partner program available for an interest test", false, "no approved program without existing interest");

  /* ---------- Buy BC unclaimed profiles ---------- */
  const [bb] = await q(`select p.id, p.slug, u.id uid, u.email from "Profile" p join "User" u on u.id=p."userId" where p."isClaimed"=false and p.certifications @> ARRAY['buy_bc'] order by p."orgName" limit 1`);
  const um = await buyer.req("POST", "/api/v1/threads", { recipientId: bb.uid, body: "Do you supply wholesale?" });
  check("unclaimed Buy BC profile cannot receive messages (422)", um.status === 422, um.status);
  const ul = await new Agent("x").req("POST", "/api/v1/auth/login", { email: bb.email, password: PW, portal: "member" });
  check("unclaimed directory accounts cannot sign in (401, or 423 once locked out)", ul.status === 401 || ul.status === 423, ul.status);
  const bbPage = await visitor.req("GET", `/directory/${bb.slug}`);
  check("Buy BC profile page lists its licensed products", bbPage.status === 200 && bbPage.text.includes("Buy BC licensed products"), bbPage.status);
  const cl = await grower.req("POST", "/api/v1/reports", { targetType: "claim", targetId: bb.id, reason: "This is our business", details: `[Live QA ${rnd}] claim test` });
  check("grower: files a claim request", cl.status === 200, `${cl.status} ${cl.text.slice(0, 120)}`);
  const queue = await admin.req("GET", "/admin/reports");
  check("admin: sees the claim in the reports queue", queue.status === 200 && queue.text.includes(`[Live QA ${rnd}]`) , queue.status);

  const emails = await q(`select count(*)::int n from "EmailOutbox" where "createdAt">=$1`, [START]);
  check("email notifications queued for the inquiries", emails[0].n > 0, `outbox=${emails[0].n}`);
} finally {
  /* ---------- Clean up everything this run created ---------- */
  const ids = (await q(`select id from "User" where email in ('grower@agrihub.test','buyer@agrihub.test','partner@agrihub.test','admin@agrihub.test')`)).map((r) => r.id);
  if (created.threads.length) await q(`delete from "Thread" where id = any($1)`, [created.threads]);
  await q(`delete from "Thread" t where t."createdAt">=$1 and exists (select 1 from "ThreadParticipant" p where p."threadId"=t.id and p."userId"=any($2))`, [START, ids]);
  if (created.demand.length) await q(`delete from "DemandPost" where id = any($1)`, [created.demand]);
  if (created.resourceInterest) await q(`delete from "ResourceInterest" where "resourceId"=$1 and "userId"=$2`, [created.resourceInterest.resourceId, created.resourceInterest.userId]);
  await q(`delete from "Report" where "createdAt">=$1 and details like '[Live QA%'`, [START]);
  await q(`delete from "Notification" where "createdAt">=$1 and "userId"=any($2)`, [START, ids]);
  await q(`delete from "EmailOutbox" where "createdAt">=$1`, [START]);
  const left = await q(`select (select count(*) from "DemandPost" where title like '[Live QA%')::int d, (select count(*) from "Message" where body like '[Live QA%')::int m`);
  console.log(`\ncleanup: leftover QA demand=${left[0].d} messages=${left[0].m}`);
  await db.end();
  const pass = results.filter((r) => r.ok).length;
  console.log(`\nLIVE RESULT: ${pass}/${results.length} passed`);
}
