import "dotenv/config";
import pg from "pg";
const B = "http://localhost:3100";
const PW = "AgriHub-Demo-2026";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const q = async (s, p = []) => (await db.query(s, p)).rows;
const results = [];
const check = (name, ok, info = "") => { results.push([ok ? "PASS" : "FAIL", name, info]); console.log(ok ? "PASS" : "FAIL", name, typeof info === "string" ? info : JSON.stringify(info).slice(0, 300)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function session() {
  const jar = {};
  const req = async (method, path, body) => {
    const headers = { cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") };
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await fetch(B + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = null; }
    return { status: r.status, json, text };
  };
  return { req, jar };
}
async function login(email, portal = "member") {
  const s = session();
  const r = await s.req("POST", "/api/v1/auth/login", { email, password: PW, portal });
  if (r.status !== 200) throw new Error(`login ${email} ${r.status} ${r.text}`);
  return s;
}
const uid = async (email) => (await q(`select id from "User" where email=$1`, [email]))[0].id;

const buyer = await login("buyer@agrihub.test");
const grower = await login("grower@agrihub.test");
const third = await login("harbour-table-restaurant-group@agrihub.test");
const anon = session();
const buyerId = await uid("buyer@agrihub.test"), growerId = await uid("grower@agrihub.test"), thirdId = await uid("harbour-table-restaurant-group@agrihub.test");
const fcc = (await q(`select "userId" from "Profile" where slug='farm-credit-canada'`))[0].userId;
// the grower's active listings, looked up fresh (IDs change on every re-seed)
const growerListings = await q(`select id, slug from "Listing" where "growerId"=$1 and status='active' order by "createdAt"`, [growerId]);
const L1 = growerListings.find((l) => l.slug.startsWith("frozen-blueberries"))?.id ?? growerListings[0].id, L2 = growerListings.find((l) => l.id !== L1).id;
const L1slug = growerListings.find((l) => l.id === L1).slug;
const L3 = growerListings.find((l) => l.id !== L1 && l.id !== L2)?.id ?? L2;
const only = process.argv[2];
const run = (k) => !only || only.split(",").includes(k);

/* 1 SEARCH */
if (run("1")) {
  let r = await anon.req("GET", "/api/v1/listings?q=blueberr");
  check("1a q=blueberr", r.status === 200 && r.json.total > 0, `total=${r.json?.total}`);
  r = await anon.req("GET", "/api/v1/listings?category=berries");
  check("1b category=berries", r.status === 200 && r.json.items.length > 0 && r.json.items.every((i) => i.category === "berries"), `total=${r.json?.total}`);
  r = await anon.req("GET", "/api/v1/listings?region=fraser-valley");
  check("1c region=fraser-valley", r.status === 200 && r.json.items.length > 0 && r.json.items.every((i) => i.region === "Fraser Valley"), `total=${r.json?.total}`);
  r = await anon.req("GET", "/api/v1/listings?cert=canadagap");
  check("1d cert=canadagap", r.status === 200 && r.json.items.length > 0 && r.json.items.every((i) => i.certifications.includes("canadagap")), `total=${r.json?.total}`);
  r = await anon.req("GET", "/api/v1/listings?sort=price_asc");
  const prices = r.json?.items.map((i) => i.price).filter((p) => p != null) ?? [];
  check("1e sort=price_asc ordered", r.status === 200 && prices.every((p, i) => i === 0 || prices[i - 1] <= p), prices.slice(0, 6).join(","));
  r = await anon.req("GET", "/api/v1/listings?sort=price_desc");
  const pd = r.json?.items.map((i) => i.price).filter((p) => p != null) ?? [];
  check("1f sort=price_desc ordered", pd.every((p, i) => i === 0 || pd[i - 1] >= p));
  r = await anon.req("GET", "/api/v1/listings?page=2");
  check("1g page=2", r.status === 200 && r.json.page === 2, `pages=${r.json?.pages} total=${r.json?.total}`);
  r = await anon.req("GET", "/api/v1/listings?category=berries,vegetable&q=zzzznotfound");
  check("1h no-match -> empty", r.status === 200 && r.json.total === 0);
  r = await anon.req("GET", "/api/v1/listings?page=abc");
  check("1i page=abc not 500", r.status !== 500, `status=${r.status}`);
  r = await anon.req("GET", "/api/v1/listings?category=notacategory");
  check("1j bogus category not 500", r.status !== 500, `status=${r.status}`);
  r = await anon.req("GET", "/api/v1/listings?page=-5");
  check("1k page=-5 clamps", r.status === 200 && r.json.page === 1, `status=${r.status}`);
  for (const p of ["/marketplace?q=blue&category=berries&region=fraser-valley&cert=canadagap&sort=price_asc&page=1", "/marketplace?page=abc", "/marketplace?category=bogus", `/marketplace/${L1slug}`, "/marketplace/does-not-exist-xyz"]) {
    r = await buyer.req("GET", p);
    const exp = p.includes("does-not-exist") ? 404 : 200;
    check(`1l HTML ${p}`, r.status === exp, `status=${r.status}`);
  }
}

/* 2 MESSAGING + 3 UNREAD + 9 XSS */
if (run("2")) {
  const tag = "qa-" + Date.now();
  let r = await buyer.req("POST", "/api/v1/threads", { recipientId: growerId, listingId: L1, body: `Hello grower ${tag}` });
  const threadId = r.json?.threadId;
  check("2a buyer starts thread", r.status === 200 && !!threadId, r.json);
  r = await grower.req("GET", `/api/v1/threads/${threadId}/messages`);
  const gm = r.json?.messages ?? [];
  check("2b grower sees buyer msg", r.status === 200 && gm.some((m) => m.body.includes(tag)));
  const lastTs = gm[gm.length - 1]?.createdAt;
  await buyer.req("GET", `/api/v1/threads/${threadId}/messages`);
  await sleep(20);
  r = await grower.req("POST", `/api/v1/threads/${threadId}/messages`, { body: `Reply ${tag}` });
  check("2c grower replies", r.status === 200 && r.json.ok, r.json);
  r = await buyer.req("GET", "/api/v1/notifications");
  const unreadThread = r.json.items.filter((n) => n.link === `/messages/${threadId}` && !n.readAt).length;
  check("3a buyer unread>0 after reply", r.json.unread > 0 && unreadThread > 0, `unread=${r.json.unread} threadUnread=${unreadThread}`);
  let html = await buyer.req("GET", "/dashboard");
  check("3b /dashboard renders", html.status === 200, `status=${html.status}`);
  r = await buyer.req("GET", `/api/v1/threads/${threadId}/messages?after=${encodeURIComponent(lastTs)}`);
  check("2d poll ?after= returns only new", r.status === 200 && r.json.messages.length === 1 && r.json.messages[0].body === `Reply ${tag}`, r.json?.messages?.map((m) => m.body));
  r = await buyer.req("GET", "/api/v1/notifications");
  const still = r.json.items.filter((n) => n.link === `/messages/${threadId}` && !n.readAt).length;
  check("3c opening thread marks notif read", still === 0, `stillUnread=${still}`);
  const parts = await q(`select "userId","lastReadAt" from "ThreadParticipant" where "threadId"=$1`, [threadId]);
  const msgs = await q(`select max("createdAt") m from "Message" where "threadId"=$1`, [threadId]);
  const bp = parts.find((p) => p.userId === buyerId);
  check("3d buyer lastReadAt >= last msg", bp && bp.lastReadAt >= msgs[0].m);
  r = await buyer.req("GET", `/api/v1/threads/${threadId}/messages`);
  check("2e thread persists", r.json.messages.filter((m) => m.body.includes(tag)).length === 2);
  r = await buyer.req("POST", "/api/v1/threads", { recipientId: growerId, listingId: L1, body: `again ${tag}` });
  check("2f same grower+listing reuses thread", r.json?.threadId === threadId, r.json);
  r = await buyer.req("POST", "/api/v1/threads", { recipientId: buyerId, body: "self" });
  check("2g message self -> 422", r.status === 422, `status=${r.status}`);
  r = await third.req("GET", `/api/v1/threads/${threadId}/messages`);
  check("2h non-participant GET -> 404", r.status === 404, `status=${r.status}`);
  r = await third.req("POST", `/api/v1/threads/${threadId}/messages`, { body: "intrude" });
  check("2i non-participant POST -> 404", r.status === 404, `status=${r.status}`);
  r = await third.req("GET", `/messages/${threadId}`);
  check("2j non-participant /messages/<id> HTML hidden", !r.text.includes(tag), `status=${r.status}`);
  r = await buyer.req("POST", "/api/v1/threads", { recipientId: fcc, body: "hello fcc" });
  check("2k unclaimed recipient -> 422", r.status === 422, `status=${r.status}`);
  r = await buyer.req("POST", "/api/v1/threads", { recipientId: thirdId, listingId: L1, body: "wrong listing owner" });
  check("2l listing not owned by recipient -> 422", r.status === 422, `status=${r.status}`);
  r = await anon.req("POST", "/api/v1/threads", { recipientId: growerId, body: "anon" });
  check("2m anonymous -> 401", r.status === 401, `status=${r.status}`);
  r = await buyer.req("GET", `/api/v1/threads/${threadId}/messages?after=garbage`);
  check("2n ?after=garbage not 500", r.status !== 500, `status=${r.status}`);
  const xss = `<script>alert(1)</script><img src=x onerror=alert(2)>${tag}`;
  r = await buyer.req("POST", `/api/v1/threads/${threadId}/messages`, { body: xss });
  check("9a XSS message accepted (stored raw)", r.status === 200);
  html = await buyer.req("GET", `/messages/${threadId}`);
  check("9b /messages/<id> 200", html.status === 200, `status=${html.status}`);
  check("9c XSS escaped in HTML", !html.text.includes("<script>alert(1)</script>") && !html.text.includes("<img src=x onerror") && (html.text.includes("&lt;script&gt;") || html.text.includes("\\u003cscript")));
  r = await buyer.req("POST", `/api/v1/threads/${threadId}/messages`, { body: "a".repeat(4001) });
  check("9d 4001-char msg -> 422", r.status === 422, `status=${r.status}`);
  r = await buyer.req("POST", `/api/v1/threads/${threadId}/messages`, { body: "a".repeat(4000) });
  check("9e 4000-char msg -> 200", r.status === 200, `status=${r.status}`);
  r = await buyer.req("POST", `/api/v1/threads/${threadId}/messages`, { body: "   " });
  check("9f whitespace-only -> 422", r.status === 422, `status=${r.status}`);
  r = await buyer.req("POST", "/api/v1/threads", { recipientId: growerId, body: "a".repeat(4001) });
  check("9g 4001 on POST /threads -> 422", r.status === 422, `status=${r.status}`);
  html = await buyer.req("GET", "/messages");
  check("9h /messages inbox 200", html.status === 200, `status=${html.status}`);
}

/* 4 RFQ */
const future = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
const past = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
const openOn = async (lid) => (await q(`select id from "Rfq" where "buyerId"=$1 and "listingId"=$2 and status in ('open','quoted')`, [buyerId, lid])).length;
if (run("4")) {
  const cands = [L1, L2, L3];
  let lid = null; for (const c of cands) if (!(await openOn(c))) { lid = c; break; }
  check("4pre listing without open RFQ found", !!lid, lid);
  const payload = { listingId: lid, quantity: 500, unit: "kg", deliveryDate: future, targetPrice: 4.5, notes: "QA rfq" };
  let r = await buyer.req("POST", "/api/v1/rfqs", payload);
  const rfqA = r.json?.rfqId;
  check("4a buyer creates RFQ", r.status === 200 && !!rfqA && !!r.json.threadId, r.json);
  r = await buyer.req("POST", "/api/v1/rfqs", payload);
  check("4b duplicate open RFQ -> 409", r.status === 409, `status=${r.status}`);
  r = await buyer.req("POST", `/api/v1/rfqs/${rfqA}`, { action: "accept" });
  check("4c accept before quote -> 409", r.status === 409, `status=${r.status}`);
  r = await buyer.req("POST", `/api/v1/rfqs/${rfqA}`, { action: "quote", price: 3 });
  check("4d buyer cannot quote -> 403", r.status === 403, `status=${r.status}`);
  r = await third.req("POST", `/api/v1/rfqs/${rfqA}`, { action: "quote", price: 3 });
  check("4e outsider act -> 404", r.status === 404, `status=${r.status}`);
  r = await grower.req("POST", `/api/v1/rfqs/${rfqA}`, { action: "quote", price: 4.25, notes: "fob abbotsford" });
  check("4f grower quotes", r.status === 200 && r.json.status === "quoted", r.json);
  r = await grower.req("POST", `/api/v1/rfqs/${rfqA}`, { action: "accept" });
  check("4g grower cannot accept -> 403", r.status === 403, `status=${r.status}`);
  const before = (await q(`select count(*)::int n from "ActivityEvent" where type='transaction' and "userId"=$1 and "ownerId"=$2`, [buyerId, growerId]))[0].n;
  r = await buyer.req("POST", `/api/v1/rfqs/${rfqA}`, { action: "accept" });
  check("4h buyer accepts", r.status === 200 && r.json.status === "accepted", r.json);
  const row = (await q(`select status,"threadId" from "Rfq" where id=$1`, [rfqA]))[0];
  check("4i DB status accepted", row.status === "accepted");
  const sys = await q(`select body from "Message" where "threadId"=$1 and kind='system' and meta->>'rfqId'=$2`, [row.threadId, rfqA]);
  check("4j system message posted", sys.some((m) => m.body.startsWith("Quote accepted")), sys.map((s) => s.body));
  const after = (await q(`select count(*)::int n from "ActivityEvent" where type='transaction' and "userId"=$1 and "ownerId"=$2`, [buyerId, growerId]))[0].n;
  check("4k ActivityEvent transaction created", after === before + 1, `${before}->${after}`);
  r = await buyer.req("POST", `/api/v1/rfqs/${rfqA}`, { action: "accept" });
  check("4l accept twice -> 409", r.status === 409, `status=${r.status}`);
  r = await buyer.req("POST", "/api/v1/rfqs", payload);
  const rfqB = r.json?.rfqId;
  check("4m new RFQ after accepted one allowed", r.status === 200, r.json);
  r = await buyer.req("POST", `/api/v1/rfqs/${rfqB}`, { action: "decline" });
  check("4n buyer cannot decline -> 403", r.status === 403, `status=${r.status}`);
  r = await grower.req("POST", `/api/v1/rfqs/${rfqB}`, { action: "decline", notes: "sold out" });
  check("4o grower declines", r.status === 200 && r.json.status === "declined", r.json);
  r = await grower.req("POST", `/api/v1/rfqs/${rfqB}`, { action: "quote", price: 1 });
  check("4p quote on declined -> 409", r.status === 409, `status=${r.status}`);
  r = await buyer.req("POST", "/api/v1/rfqs", payload);
  const rfqC = r.json?.rfqId;
  r = await grower.req("POST", `/api/v1/rfqs/${rfqC}`, { action: "withdraw" });
  check("4q grower cannot withdraw -> 403", r.status === 403, `status=${r.status}`);
  r = await buyer.req("POST", `/api/v1/rfqs/${rfqC}`, { action: "withdraw" });
  check("4r buyer withdraws", r.status === 200 && r.json.status === "withdrawn", r.json);
  r = await buyer.req("POST", "/api/v1/rfqs", { ...payload, deliveryDate: past });
  check("4s past delivery date -> 422", r.status === 422, `status=${r.status}`);
  // yesterday as a calendar date in Pacific time (the form sends YYYY-MM-DD)
  const yday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "America/Vancouver" });
  r = await buyer.req("POST", "/api/v1/rfqs", { ...payload, deliveryDate: yday });
  check("4t delivery yesterday (Pacific) -> 422", r.status === 422, `status=${r.status}`);
  if (r.status === 200) await buyer.req("POST", `/api/v1/rfqs/${r.json.rfqId}`, { action: "withdraw" });
  r = await grower.req("POST", "/api/v1/rfqs", { ...payload });
  check("4u RFQ on own listing -> 422", r.status === 422, `status=${r.status}`);
  r = await buyer.req("POST", "/api/v1/rfqs", { ...payload, quantity: -1 });
  check("4v negative qty -> 422", r.status === 422, `status=${r.status}`);
  r = await buyer.req("POST", "/api/v1/rfqs", { ...payload, unit: "parsec" });
  check("4w bad unit -> 422", r.status === 422, `status=${r.status}`);
  r = await buyer.req("POST", "/api/v1/rfqs", payload);
  const rfqD = r.json?.rfqId;
  await grower.req("POST", `/api/v1/rfqs/${rfqD}`, { action: "quote", price: 4 });
  const b0 = (await q(`select count(*)::int n from "ActivityEvent" where type='transaction' and "userId"=$1`, [buyerId]))[0].n;
  const rs = await Promise.all([1, 2, 3].map(() => buyer.req("POST", `/api/v1/rfqs/${rfqD}`, { action: "accept" })));
  const b1 = (await q(`select count(*)::int n from "ActivityEvent" where type='transaction' and "userId"=$1`, [buyerId]))[0].n;
  check("4x concurrent accepts -> single transaction", b1 - b0 === 1 && rs.filter((x) => x.status === 200).length === 1, `200s=${rs.filter((x) => x.status === 200).length} txEvents=${b1 - b0}`);
  const rs2 = await Promise.all([1, 2, 3].map(() => buyer.req("POST", "/api/v1/rfqs", payload)));
  const ok2 = rs2.filter((x) => x.status === 200);
  check("4y concurrent RFQ create -> single open RFQ", ok2.length === 1, `200s=${ok2.length}`);
  for (const x of ok2) await buyer.req("POST", `/api/v1/rfqs/${x.json.rfqId}`, { action: "withdraw" });
}

/* 5 REVIEWS */
if (run("5")) {
  let r = await buyer.req("POST", "/api/v1/reviews", { subjectId: growerId, rating: 5, body: "QA review: great berries" });
  check("5a buyer w/ RFQ reviews grower", r.status === 200, r.json);
  r = await buyer.req("POST", "/api/v1/reviews", { subjectId: growerId, rating: 6 });
  check("5b rating 6 -> 422", r.status === 422, `status=${r.status}`);
  r = await buyer.req("POST", "/api/v1/reviews", { subjectId: growerId, rating: 0 });
  check("5c rating 0 -> 422", r.status === 422, `status=${r.status}`);
  const thirdTraded = (await q(`select count(*)::int n from "Rfq" where ("buyerId"=$1 and "growerId"=$2) or ("buyerId"=$2 and "growerId"=$1)`, [thirdId, growerId]))[0].n;
  r = await third.req("POST", "/api/v1/reviews", { subjectId: growerId, rating: 1, body: "fake" });
  check("5d no-RFQ user -> 403", thirdTraded ? true : r.status === 403, `traded=${thirdTraded} status=${r.status}`);
  r = await buyer.req("POST", "/api/v1/reviews", { subjectId: buyerId, rating: 5 });
  check("5e self review -> 422", r.status === 422, `status=${r.status}`);
  const html = await anon.req("GET", "/directory/sumas-prairie-berry-co");
  check("5f review on /directory/<slug>", html.status === 200 && html.text.includes("QA review: great berries"), `status=${html.status}`);
}

/* 6 DEMAND */
if (run("6")) {
  const tag = "QA demand " + Date.now();
  let r = await buyer.req("POST", "/api/v1/demand", { title: tag, produce: "Blueberries", category: "berries", quantity: 1000, unit: "kg", frequency: "weekly", neededBy: future, targetPrice: 5 });
  const demandId = r.json?.id;
  check("6a buyer posts demand", r.status === 200 && r.json.ok && typeof r.json.matchedGrowers === "number", r.json);
  const n = await q(`select count(*)::int n from "Notification" where type='demand_match' and "userId"=$1 and link=$2`, [growerId, `/demand/${demandId}`]);
  check("6b seed grower got demand_match", n[0].n === 1, `n=${n[0].n}`);
  const all = await q(`select count(distinct "userId")::int n from "Notification" where type='demand_match' and link=$1`, [`/demand/${demandId}`]);
  check("6c notified count == matchedGrowers", all[0].n === r.json.matchedGrowers, `${all[0].n} vs ${r.json.matchedGrowers}`);
  let page = await anon.req("GET", "/demand");
  check("6d open post listed on /demand", page.status === 200 && page.text.includes(tag), `status=${page.status}`);
  r = await grower.req("POST", `/api/v1/demand/${demandId}`, { message: "We can supply weekly IQF blueberries." });
  check("6e grower offer creates thread", r.status === 200 && !!r.json.threadId, r.json);
  const offerThread = r.json?.threadId;
  r = await buyer.req("GET", `/api/v1/threads/${offerThread}/messages`);
  check("6f buyer sees offer in thread", r.status === 200 && r.json.messages.some((m) => m.body.includes("Offer to supply")));
  r = await buyer.req("POST", `/api/v1/demand/${demandId}`, { message: "self offer test" });
  check("6g buyer cannot offer -> 403", r.status === 403, `status=${r.status}`);
  r = await grower.req("POST", "/api/v1/demand", { title: "grower demand", produce: "Corn", category: "vegetable", quantity: 1, unit: "kg", frequency: "weekly" });
  check("6h grower create demand -> 403", r.status === 403, `status=${r.status}`);
  r = await third.req("PATCH", `/api/v1/demand/${demandId}`, { isOpen: false });
  check("6i other buyer PATCH -> 404", r.status === 404, `status=${r.status}`);
  r = await buyer.req("PATCH", `/api/v1/demand/${demandId}`, { isOpen: false });
  check("6j buyer closes post", r.status === 200, `status=${r.status}`);
  page = await anon.req("GET", "/demand");
  check("6k closed post not on /demand", page.status === 200 && !page.text.includes(tag));
  r = await grower.req("POST", `/api/v1/demand/${demandId}`, { message: "offer on closed post" });
  check("6l offer on closed post -> 404", r.status === 404, `status=${r.status}`);
  r = await buyer.req("POST", "/api/v1/demand", { title: tag + " R", produce: "Kale", category: "vegetable", quantity: 5, unit: "kg", frequency: "one_time" });
  const rejId = r.json?.id;
  await db.query(`update "DemandPost" set approval='rejected' where id=$1`, [rejId]);
  r = await grower.req("POST", `/api/v1/demand/${rejId}`, { message: "offer on rejected post" });
  check("6m offer on rejected post blocked", r.status === 404, `status=${r.status}`);
  await db.query(`update "DemandPost" set "isOpen"=false where id=$1`, [rejId]);
}

/* 7 FAVORITES */
if (run("7")) {
  let r = await buyer.req("POST", `/api/v1/favorites/${L2}`);
  check("7a favourite", r.status === 200 && r.json.saved === true, r.json);
  const html = await buyer.req("GET", "/dashboard/saved");
  check("7b /dashboard/saved lists it", html.status === 200 && html.text.includes((await q(`select title from "Listing" where id=$1`, [L2]))[0].title.split(" — ")[0]), `status=${html.status}`);
  r = await buyer.req("DELETE", `/api/v1/favorites/${L2}`);
  check("7c unfavourite", r.status === 200 && r.json.saved === false);
  const n = await q(`select count(*)::int n from "Favorite" where "userId"=$1 and "listingId"=$2`, [buyerId, L2]);
  check("7d removed from DB", n[0].n === 0);
  r = await buyer.req("POST", `/api/v1/favorites/nonexistent`);
  check("7e favourite missing listing -> 404", r.status === 404, `status=${r.status}`);
  r = await anon.req("POST", `/api/v1/favorites/${L2}`);
  check("7f anon favourite -> 401", r.status === 401, `status=${r.status}`);
}

/* 8 DASHBOARD */
if (run("8")) {
  const quoted = (await q(`select count(*)::int n from "Rfq" where "buyerId"=$1 and status='quoted'`, [buyerId]))[0].n;
  let html = await buyer.req("GET", "/dashboard");
  const plain = html.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const m = plain.match(/.{0,80}[Qq]uotes? to review.{0,80}/);
  check("8a /dashboard shows quotes-to-review", html.status === 200 && !!m, `dbQuoted=${quoted} ctx=${m?.[0]}`);
  html = await buyer.req("GET", "/dashboard/rfqs");
  check("8b /dashboard/rfqs lists RFQs", html.status === 200 && (html.text.includes("Frozen Blueberries") || html.text.includes("Floricane") || html.text.includes("Highbush")), `status=${html.status}`);
  html = await grower.req("GET", "/dashboard/rfqs");
  check("8c grower /dashboard/rfqs 200", html.status === 200, `status=${html.status}`);
}

console.log("\nSUMMARY", results.filter((r) => r[0] === "PASS").length, "pass /", results.filter((r) => r[0] === "FAIL").length, "fail");
for (const r of results.filter((r) => r[0] === "FAIL")) console.log("FAIL", r[1], typeof r[2] === "string" ? r[2] : JSON.stringify(r[2]));
await db.end();
